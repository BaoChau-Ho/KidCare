import { ConflictException, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { DataSource, Not } from 'typeorm';
import {
  createDataSourceMock,
  createRepositoryMock,
  expectHttpError,
  getError,
  RepositoryMock,
} from '../../helpers/mocks';
import { User } from '../../../src/users/user.entity';
import { RegistrationRequest } from '../../../src/registration-requests/registration-request.entity';
import { RegistrationRequestsService } from '../../../src/registration-requests/registration-requests.service';

// Giai đoạn 1 — đăng ký, admin duyệt / từ chối, danh sách yêu cầu.
// Danh sách test và tiến độ: backend/test/README.md.

jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
const mockedArgon2 = jest.mocked(argon2);

const PASSWORD = 'Password@123';
const REQUEST_ID = '5f1d7c2a-3b4e-4c6d-8e9f-0a1b2c3d4e5f';
const LOCK = { mode: 'pessimistic_write' };

const input = {
  fullName: 'Nguyễn Văn A',
  email: 'parent@demo.com',
  phone: '0912345678',
  role: 'PARENT',
  nationalId: '012345678901',
  password: PASSWORD,
};

const makeRequest = (
  overrides: Partial<RegistrationRequest> = {},
): RegistrationRequest => ({
  id: REQUEST_ID,
  fullName: 'Nguyễn Văn A',
  email: 'parent@demo.com',
  phone: '0912345678',
  role: 'PARENT',
  nationalId: '012345678901',
  status: 'PENDING',
  createdAt: new Date('2026-11-01T00:00:00Z'),
  rejectionReason: null,
  passwordSetupTokenHash: null,
  passwordSetupExpiresAt: null,
  ...overrides,
});

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  email: 'parent@demo.com',
  passwordHash: 'hashed',
  fullName: 'Nguyễn Văn A',
  role: 'PARENT',
  status: 'INACTIVE',
  phone: '0912345678',
  nationalId: '012345678901',
  createdAt: new Date('2026-11-01T00:00:00Z'),
  ...overrides,
});

describe('GĐ1 · RegistrationRequestsService', () => {
  let userRepository: RepositoryMock;
  let requestRepository: RepositoryMock;
  let dataSource: ReturnType<typeof createDataSourceMock>;
  let service: RegistrationRequestsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedArgon2.hash.mockResolvedValue('hashed');

    userRepository = createRepositoryMock();
    requestRepository = createRepositoryMock();
    requestRepository.save.mockImplementation(async (entity: object) => ({
      id: REQUEST_ID,
      ...entity,
    }));
    dataSource = createDataSourceMock(
      new Map<unknown, RepositoryMock>([
        [User, userRepository],
        [RegistrationRequest, requestRepository],
      ]),
    );
    service = new RegistrationRequestsService(
      dataSource as unknown as DataSource,
    );
  });

  describe('submit', () => {
    it('UT-REG-01 đăng ký thành công → tạo tài khoản và yêu cầu ở trạng thái chờ', async () => {
      const result = await service.submit(input);

      expect(result).toEqual({ id: REQUEST_ID, status: 'PENDING' });
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'INACTIVE',
          passwordHash: 'hashed',
          role: 'PARENT',
        }),
      );
      expect(requestRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PENDING' }),
      );
    });

    it('UT-REG-02 email và CCCD được chuẩn hóa trước khi kiểm tra và lưu', async () => {
      await service.submit({
        ...input,
        email: '  Parent@Demo.com ',
        nationalId: ' 012345678901 ',
      });

      expect(userRepository.findOneBy).toHaveBeenCalledWith({
        email: 'parent@demo.com',
      });
      expect(userRepository.findOneBy).toHaveBeenCalledWith({
        nationalId: '012345678901',
      });
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'parent@demo.com',
          nationalId: '012345678901',
        }),
      );
    });

    it('UT-REG-03 mật khẩu được hash, không bản ghi nào chứa mật khẩu gốc', async () => {
      await service.submit(input);

      expect(mockedArgon2.hash).toHaveBeenCalledWith(PASSWORD);
      const stored = JSON.stringify([
        userRepository.create.mock.calls,
        requestRepository.create.mock.calls,
      ]);
      expect(stored).not.toContain(PASSWORD);
    });

    it('UT-REG-04 email đã có tài khoản → 409 EMAIL_EXISTS', async () => {
      userRepository.findOneBy.mockImplementation(async (where: object) =>
        'email' in where ? makeUser({ status: 'ACTIVE' }) : null,
      );

      expectHttpError(
        await getError(() => service.submit(input)),
        ConflictException,
        'EMAIL_EXISTS',
      );
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('UT-REG-05 CCCD đã có tài khoản → 409 ID_EXISTS', async () => {
      userRepository.findOneBy.mockImplementation(async (where: object) =>
        'nationalId' in where ? makeUser({ status: 'ACTIVE' }) : null,
      );

      expectHttpError(
        await getError(() => service.submit(input)),
        ConflictException,
        'ID_EXISTS',
      );
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('UT-REG-06 email đang có yêu cầu chưa bị từ chối → 409 EMAIL_EXISTS', async () => {
      requestRepository.findOneBy.mockImplementation(async (where: object) =>
        'email' in where ? makeRequest() : null,
      );

      expectHttpError(
        await getError(() => service.submit(input)),
        ConflictException,
        'EMAIL_EXISTS',
      );
    });

    it('UT-REG-07 CCCD đang có yêu cầu chưa bị từ chối → 409 ID_EXISTS', async () => {
      requestRepository.findOneBy.mockImplementation(async (where: object) =>
        'nationalId' in where ? makeRequest() : null,
      );

      expectHttpError(
        await getError(() => service.submit(input)),
        ConflictException,
        'ID_EXISTS',
      );
    });

    it('UT-REG-08 chỉ chặn yêu cầu chưa bị từ chối', async () => {
      await service.submit(input);

      expect(requestRepository.findOneBy).toHaveBeenCalledWith({
        email: 'parent@demo.com',
        status: Not('REJECTED'),
      });
      expect(requestRepository.findOneBy).toHaveBeenCalledWith({
        nationalId: '012345678901',
        status: Not('REJECTED'),
      });
    });

    it('UT-REG-09 database báo trùng (mã 23505) → 409 REGISTRATION_CONFLICT', async () => {
      dataSource.transaction.mockRejectedValueOnce({ code: '23505' });

      const error = await getError(() => service.submit(input));

      expectHttpError(error, ConflictException, 'REGISTRATION_CONFLICT');
    });

    it('UT-REG-10 lỗi database khác được ném lại nguyên vẹn', async () => {
      const connectionError = new Error('connection lost');
      dataSource.transaction.mockRejectedValueOnce(connectionError);

      expect(await getError(() => service.submit(input))).toBe(connectionError);
    });
  });

  describe('approve', () => {
    it('UT-APPROVE-01 không tìm thấy yêu cầu → 404 REQUEST_NOT_FOUND', async () => {
      expectHttpError(
        await getError(() => service.approve(REQUEST_ID)),
        NotFoundException,
        'REQUEST_NOT_FOUND',
      );
    });

    it.each(['APPROVED', 'REJECTED', 'COMPLETED'])(
      'UT-APPROVE-02 yêu cầu đã ở trạng thái %s → 409 REQUEST_ALREADY_REVIEWED',
      async (status) => {
        requestRepository.findOne.mockResolvedValue(makeRequest({ status }));

        const error = await getError(() => service.approve(REQUEST_ID));

        expectHttpError(error, ConflictException, 'REQUEST_ALREADY_REVIEWED');
      },
    );

    it.each([
      ['không có tài khoản', null],
      ['tài khoản đã active', makeUser({ status: 'ACTIVE' })],
    ])(
      'UT-APPROVE-03 %s → 409 PENDING_ACCOUNT_NOT_FOUND',
      async (_case, user) => {
        requestRepository.findOne.mockResolvedValue(makeRequest());
        userRepository.findOne.mockResolvedValue(user);

        const error = await getError(() => service.approve(REQUEST_ID));

        expectHttpError(error, ConflictException, 'PENDING_ACCOUNT_NOT_FOUND');
      },
    );

    it('UT-APPROVE-04 duyệt thành công → tài khoản active, yêu cầu approved', async () => {
      const request = makeRequest({ rejectionReason: 'cũ' });
      const user = makeUser();
      requestRepository.findOne.mockResolvedValue(request);
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.approve(REQUEST_ID);

      expect(user.status).toBe('ACTIVE');
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(request).toMatchObject({
        status: 'APPROVED',
        rejectionReason: null,
      });
      expect(result).toEqual({
        id: REQUEST_ID,
        status: 'APPROVED',
        email: 'parent@demo.com',
      });
    });

    it('UT-APPROVE-05 khóa dòng yêu cầu và tài khoản khi duyệt', async () => {
      requestRepository.findOne.mockResolvedValue(makeRequest());
      userRepository.findOne.mockResolvedValue(makeUser());

      await service.approve(REQUEST_ID);

      expect(requestRepository.findOne).toHaveBeenCalledWith({
        where: { id: REQUEST_ID },
        lock: LOCK,
      });
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'parent@demo.com' },
        lock: LOCK,
      });
    });
  });

  describe('reject', () => {
    it('UT-REJECT-01 không tìm thấy yêu cầu → 404 REQUEST_NOT_FOUND', async () => {
      const error = await getError(() => service.reject(REQUEST_ID, 'Sai CCCD'));

      expectHttpError(error, NotFoundException, 'REQUEST_NOT_FOUND');
    });

    it('UT-REJECT-02 yêu cầu đã xử lý → 409 REQUEST_ALREADY_REVIEWED', async () => {
      requestRepository.findOne.mockResolvedValue(
        makeRequest({ status: 'APPROVED' }),
      );

      const error = await getError(() => service.reject(REQUEST_ID, 'Sai CCCD'));

      expectHttpError(error, ConflictException, 'REQUEST_ALREADY_REVIEWED');
    });

    it('UT-REJECT-03 có tài khoản đang chờ → xóa tài khoản đó', async () => {
      const pendingUser = makeUser();
      requestRepository.findOne.mockResolvedValue(makeRequest());
      userRepository.findOneBy.mockResolvedValue(pendingUser);

      await service.reject(REQUEST_ID, 'Sai CCCD');

      expect(userRepository.findOneBy).toHaveBeenCalledWith({
        email: 'parent@demo.com',
        status: 'INACTIVE',
      });
      expect(userRepository.remove).toHaveBeenCalledWith(pendingUser);
    });

    it('UT-REJECT-04 không có tài khoản đang chờ → vẫn từ chối, không xóa gì', async () => {
      requestRepository.findOne.mockResolvedValue(makeRequest());

      await expect(service.reject(REQUEST_ID, 'Sai CCCD')).resolves.toMatchObject({
        status: 'REJECTED',
      });
      expect(userRepository.remove).not.toHaveBeenCalled();
    });

    it('UT-REJECT-05 lý do được trim, yêu cầu chuyển rejected', async () => {
      requestRepository.findOne.mockResolvedValue(makeRequest());

      const result = await service.reject(REQUEST_ID, '  Sai CCCD  ');

      expect(result).toEqual({
        id: REQUEST_ID,
        status: 'REJECTED',
        rejectionReason: 'Sai CCCD',
      });
      expect(requestRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordSetupTokenHash: null,
          passwordSetupExpiresAt: null,
        }),
      );
    });
  });

  describe('list', () => {
    it('UT-LIST-01 không trả các trường bí mật của link đặt mật khẩu', async () => {
      await service.list();

      const [options] = requestRepository.find.mock.calls[0] as [
        { select: object },
      ];
      expect(options.select).not.toHaveProperty('passwordSetupTokenHash');
      expect(options.select).not.toHaveProperty('passwordSetupExpiresAt');
    });

    it('UT-LIST-02 sắp xếp yêu cầu mới nhất lên đầu', async () => {
      await service.list();

      expect(requestRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC', id: 'DESC' } }),
      );
    });
  });
});
