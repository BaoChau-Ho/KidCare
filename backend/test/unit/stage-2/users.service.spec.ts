import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { DataSource, Repository } from 'typeorm';
import {
  createDataSourceMock,
  createQueryBuilderMock,
  createRepositoryMock,
  expectHttpError,
  getError,
  invalidFields,
  RepositoryMock,
  whereClauses,
} from '../../helpers/mocks';
import { AuditLogsService } from '../../../src/audit-logs/audit-logs.service';
import { ChangeUserRoleDto } from '../../../src/users/dto/change-user-role.dto';
import { ListUsersQueryDto } from '../../../src/users/dto/list-users-query.dto';
import { User } from '../../../src/users/user.entity';
import { UsersService } from '../../../src/users/users.service';

// Giai đoạn 2 — UC-03 quản lý tài khoản (Admin).
// Danh sách test và tiến độ: backend/test/README.md.

jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
const mockedArgon2 = jest.mocked(argon2);

const ADMIN = { id: 'a0000000-0000-4000-8000-000000000001', fullName: 'Admin', role: 'ADMIN' as const };
const USER_ID = 'b0000000-0000-4000-8000-000000000002';
const IP = '10.0.0.1';
const TEMP_PASSWORD = 'Temp@12345';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: USER_ID,
  email: 'teacher@demo.com',
  passwordHash: 'hashed-secret',
  fullName: 'Giáo viên A',
  role: 'TEACHER',
  status: 'ACTIVE',
  phone: '0912345678',
  nationalId: '012345678901',
  createdAt: new Date('2026-11-01T00:00:00Z'),
  ...overrides,
});

const listQuery = (overrides: Partial<ListUsersQueryDto> = {}) =>
  Object.assign(new ListUsersQueryDto(), overrides);

describe('GĐ2 · UsersService', () => {
  let usersRepository: RepositoryMock;
  let auditLogs: { record: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    jest.resetAllMocks();
    mockedArgon2.hash.mockResolvedValue('hashed-temp' as never);
    usersRepository = createRepositoryMock();
    usersRepository.save.mockImplementation(async (user: User) =>
      Object.assign({ id: USER_ID, createdAt: new Date('2026-11-06T00:00:00Z') }, user),
    );
    auditLogs = { record: jest.fn().mockResolvedValue(undefined) };
    const dataSource = createDataSourceMock(new Map([[User, usersRepository]]));
    service = new UsersService(
      usersRepository as unknown as Repository<User>,
      dataSource as unknown as DataSource,
      auditLogs as unknown as AuditLogsService,
    );
  });

  const auditPayload = () => auditLogs.record.mock.calls[0][1];

  describe('create', () => {
    const dto = {
      fullName: '  Giáo viên A ',
      email: ' Teacher@Demo.COM ',
      phone: ' 0912345678 ',
      temporaryPassword: TEMP_PASSWORD,
      role: 'TEACHER' as const,
    };

    it('UT-USER-01 tạo tài khoản hợp lệ: email chuẩn hóa, mật khẩu tạm được hash, không trả hash', async () => {
      const result = await service.create(dto, ADMIN, IP);

      expect(mockedArgon2.hash).toHaveBeenCalledWith(TEMP_PASSWORD);
      expect(usersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'teacher@demo.com',
          fullName: 'Giáo viên A',
          phone: '0912345678',
          passwordHash: 'hashed-temp',
          role: 'TEACHER',
          status: 'ACTIVE',
          nationalId: null,
        }),
      );
      expect(result).toMatchObject({ email: 'teacher@demo.com', role: 'TEACHER', status: 'ACTIVE' });
      expect(result).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(result)).not.toContain('hashed-temp');
      expect(auditPayload()).toMatchObject({
        actorUserId: ADMIN.id,
        action: 'CREATE_USER',
        resourceType: 'user',
        newValue: { role: 'TEACHER', status: 'ACTIVE' },
        ipAddress: IP,
      });
    });

    it('UT-USER-02 tạo tài khoản email trùng → 409, không lưu', async () => {
      usersRepository.findOneBy.mockResolvedValue(makeUser());
      expectHttpError(await getError(() => service.create(dto, ADMIN, IP)), ConflictException, 'EMAIL_EXISTS');
      expect(usersRepository.save).not.toHaveBeenCalled();
      expect(auditLogs.record).not.toHaveBeenCalled();
    });

    it('UT-USER-02b hai request tạo cùng email chạy song song (unique violation từ DB) → vẫn 409 EMAIL_EXISTS', async () => {
      usersRepository.save.mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505' }));
      expectHttpError(await getError(() => service.create(dto, ADMIN, IP)), ConflictException, 'EMAIL_EXISTS');
    });
  });

  describe('list', () => {
    it('UT-USER-03 danh sách có phân trang: mặc định page 1 / limit 20, offset tính đúng, tổng số trang làm tròn lên', async () => {
      const qb = createQueryBuilderMock([makeUser()], 45);
      usersRepository.createQueryBuilder.mockReturnValue(qb);

      expect(listQuery()).toMatchObject({ page: 1, limit: 20 });
      const result = await service.list(listQuery({ page: 3, limit: 10 }), ADMIN);

      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result.pageInfo).toEqual({ page: 3, limit: 10, totalItems: 45, totalPages: 5 });
    });

    // Code hiện trả 400 khi limit > 100 (DTO @Max(100)), không tự giới hạn về 100 như tên todo ban đầu.
    it.each([
      [{ limit: '101' }, ['limit']],
      [{ limit: '0' }, ['limit']],
      [{ page: '0' }, ['page']],
      [{ limit: '100', page: '1' }, []],
    ])('UT-USER-03b query %j → trường lỗi %j', async (input, expected) => {
      expect(await invalidFields(ListUsersQueryDto, input)).toEqual(expected);
    });

    it('UT-USER-03c không chọn passwordHash và nationalId khi trả danh sách', async () => {
      const qb = createQueryBuilderMock();
      usersRepository.createQueryBuilder.mockReturnValue(qb);
      await service.list(listQuery(), ADMIN);
      const selected: string[] = qb.select.mock.calls[0][0];
      expect(selected).not.toContain('user.passwordHash');
      expect(selected).not.toContain('user.nationalId');
    });

    it('UT-USER-04 admin lọc theo role, status, từ khóa (không phân biệt hoa thường)', async () => {
      const qb = createQueryBuilderMock();
      usersRepository.createQueryBuilder.mockReturnValue(qb);
      await service.list(listQuery({ role: 'TEACHER', status: 'LOCKED', query: 'NguYen' }), ADMIN);
      const clauses = whereClauses(qb);
      expect(clauses).toContain('"role":"TEACHER"');
      expect(clauses).toContain('"status":"LOCKED"');
      expect(clauses).toContain('"search":"%nguyen%"');
    });

    it('UT-USER-04b quản lý chỉ tra cứu được TEACHER / PARENT đang hoạt động', async () => {
      const qb = createQueryBuilderMock();
      usersRepository.createQueryBuilder.mockReturnValue(qb);
      const manager = { ...ADMIN, role: 'MANAGER' as const };

      expectHttpError(await getError(() => service.list(listQuery(), manager)), ForbiddenException, 'MANAGER_LOOKUP_REQUIRES_ROLE');
      expectHttpError(
        await getError(() => service.list(listQuery({ role: 'ADMIN' }), manager)),
        ForbiddenException,
        'MANAGER_LOOKUP_REQUIRES_ROLE',
      );

      await service.list(listQuery({ role: 'PARENT', status: 'LOCKED' }), manager);
      const clauses = whereClauses(qb);
      expect(clauses).toContain('"activeStatus":"ACTIVE"');
      expect(clauses).not.toContain('"status":"LOCKED"'); // bộ lọc status của quản lý bị bỏ qua
    });

    it.each(['TEACHER', 'PARENT', 'MEDICAL_STAFF'] as const)(
      'UT-USER-04c vai trò %s không xem được danh sách tài khoản → 403',
      async (role) => {
        expectHttpError(
          await getError(() => service.list(listQuery(), { ...ADMIN, role })),
          ForbiddenException,
          'USERS_ACCESS_DENIED',
        );
      },
    );
  });

  describe('update / changeRole / changeStatus', () => {
    it('UT-USER-05 sửa thông tin chỉ cập nhật họ tên và SĐT; SĐT rỗng thành null', async () => {
      usersRepository.findOneBy.mockResolvedValue(makeUser());
      const result = await service.update(USER_ID, { fullName: ' Tên mới ', phone: '' }, ADMIN, IP);

      const saved: User = usersRepository.save.mock.calls[0][0];
      expect(saved).toMatchObject({ fullName: 'Tên mới', phone: null, email: 'teacher@demo.com', role: 'TEACHER', status: 'ACTIVE' });
      expect(result).not.toHaveProperty('passwordHash');
      expect(auditPayload()).toMatchObject({
        action: 'UPDATE_USER',
        oldValue: { fullName: 'Giáo viên A', phone: '0912345678' },
        newValue: { fullName: 'Tên mới', phone: null },
      });
    });

    it('UT-USER-05b không gửi trường nào → 400 EMPTY_UPDATE, không đọc database', async () => {
      expectHttpError(await getError(() => service.update(USER_ID, {}, ADMIN, IP)), BadRequestException, 'EMPTY_UPDATE');
      expect(usersRepository.findOneBy).not.toHaveBeenCalled();
    });

    it('UT-USER-06 đổi role hợp lệ → lưu và ghi audit log giá trị cũ / mới', async () => {
      usersRepository.findOneBy.mockResolvedValue(makeUser({ role: 'TEACHER' }));
      const result = await service.changeRole(USER_ID, { role: 'MANAGER' }, ADMIN, IP);

      expect(result.role).toBe('MANAGER');
      expect(auditPayload()).toMatchObject({
        actorUserId: ADMIN.id,
        action: 'CHANGE_USER_ROLE',
        resourceId: USER_ID,
        oldValue: { role: 'TEACHER' },
        newValue: { role: 'MANAGER' },
        ipAddress: IP,
      });
    });

    it.each(['SUPERADMIN', 'admin', '', null])('UT-USER-07 đổi sang role không hợp lệ %j → 400', async (role) => {
      expect(await invalidFields(ChangeUserRoleDto, { role })).toEqual(['role']);
    });

    it('UT-USER-08 khóa tài khoản → đổi trạng thái và ghi audit log', async () => {
      usersRepository.findOneBy.mockResolvedValue(makeUser({ status: 'ACTIVE' }));
      const result = await service.changeStatus(USER_ID, { status: 'LOCKED' }, ADMIN, IP);

      expect(result.status).toBe('LOCKED');
      expect(auditPayload()).toMatchObject({
        action: 'CHANGE_USER_STATUS',
        oldValue: { status: 'ACTIVE' },
        newValue: { status: 'LOCKED' },
      });
    });

    it.each(['LOCKED', 'INACTIVE'] as const)('UT-USER-09 admin tự chuyển chính mình sang %s → 403, không lưu', async (status) => {
      usersRepository.findOneBy.mockResolvedValue(makeUser({ id: ADMIN.id, role: 'ADMIN' }));
      expectHttpError(
        await getError(() => service.changeStatus(ADMIN.id, { status }, ADMIN, IP)),
        ForbiddenException,
        'SELF_STATUS_CHANGE',
      );
      expect(usersRepository.save).not.toHaveBeenCalled();
      expect(auditLogs.record).not.toHaveBeenCalled();
    });

    it.each([
      ['update', (s: UsersService) => s.update(USER_ID, { fullName: 'X' }, ADMIN, IP)],
      ['changeRole', (s: UsersService) => s.changeRole(USER_ID, { role: 'PARENT' }, ADMIN, IP)],
      ['changeStatus', (s: UsersService) => s.changeStatus(USER_ID, { status: 'LOCKED' }, ADMIN, IP)],
    ])('UT-USER-10 %s trên tài khoản không tồn tại → 404', async (_name, action) => {
      expectHttpError(await getError(() => action(service)), NotFoundException, 'USER_NOT_FOUND');
      expect(usersRepository.save).not.toHaveBeenCalled();
    });
  });

  it('UT-USER-11 audit log của mọi thao tác không chứa mật khẩu, hash, token, CCCD', async () => {
    usersRepository.findOneBy.mockResolvedValueOnce(null); // create: email chưa tồn tại
    await service.create(
      { fullName: 'A', email: 'a@demo.com', temporaryPassword: TEMP_PASSWORD, role: 'PARENT' },
      ADMIN,
      IP,
    );
    usersRepository.findOneBy.mockImplementation(async () => makeUser());
    await service.update(USER_ID, { fullName: 'B' }, ADMIN, IP);
    await service.changeRole(USER_ID, { role: 'PARENT' }, ADMIN, IP);
    await service.changeStatus(USER_ID, { status: 'LOCKED' }, ADMIN, IP);

    expect(auditLogs.record).toHaveBeenCalledTimes(4);
    const logged = JSON.stringify(auditLogs.record.mock.calls.map(([, payload]) => payload));
    for (const secret of [TEMP_PASSWORD, 'hashed-temp', 'hashed-secret', 'passwordHash', 'token', '012345678901']) {
      expect(logged).not.toContain(secret);
    }
  });
});
