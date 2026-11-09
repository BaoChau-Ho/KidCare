import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
import { ChildParent } from '../../../src/children/child-parent.entity';
import { Child } from '../../../src/children/child.entity';
import { ChildrenService } from '../../../src/children/children.service';
import { LinkParentDto } from '../../../src/children/dto/link-parent.dto';
import { ListChildrenQueryDto } from '../../../src/children/dto/list-children-query.dto';
import { UpdateChildDto } from '../../../src/children/dto/update-child.dto';
import { ClassTeacher } from '../../../src/classes/class-teacher.entity';
import { Classroom } from '../../../src/classes/class.entity';
import { User } from '../../../src/users/user.entity';

// Giai đoạn 2 — UC-04 quản lý hồ sơ trẻ và liên kết phụ huynh.
// Danh sách test và tiến độ: backend/test/README.md.

const MANAGER = { id: 'a1000000-0000-4000-8000-000000000001', email: 'manager@demo.com', fullName: 'Quản lý', role: 'MANAGER' as const };
const PARENT = { ...MANAGER, id: 'a2000000-0000-4000-8000-000000000002', email: 'parent@demo.com', role: 'PARENT' as const };
const TEACHER = { ...MANAGER, id: 'a3000000-0000-4000-8000-000000000003', email: 'teacher@demo.com', role: 'TEACHER' as const };
const CHILD_ID = 'c1000000-0000-4000-8000-000000000001';
const CLASS_ID = 'c2000000-0000-4000-8000-000000000002';
const IP = '10.0.0.1';

const childDto = {
  name: 'Bé An',
  dateOfBirth: '2022-05-10',
  gender: 'MALE' as const,
  address: '  Hà Nội  ',
  classId: CLASS_ID,
};

const makeChild = (overrides: Partial<Child> = {}): Child => ({
  id: CHILD_ID,
  name: 'Bé An',
  dateOfBirth: '2022-05-10',
  gender: 'MALE',
  address: 'Hà Nội',
  avatarUrl: null,
  classId: CLASS_ID,
  status: 'ACTIVE',
  createdAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date('2026-11-01T00:00:00Z'),
  ...overrides,
});

const activeClass = { id: CLASS_ID, name: 'Lá 1', academicYear: '2026-2027', status: 'ACTIVE' };
const activeParent = { id: PARENT.id, email: PARENT.email, fullName: 'Phụ huynh A', role: 'PARENT', status: 'ACTIVE' };

describe('GĐ2 · ChildrenService', () => {
  let children: RepositoryMock;
  let links: RepositoryMock;
  let classes: RepositoryMock;
  let assignments: RepositoryMock;
  let users: RepositoryMock;
  let auditLogs: { record: jest.Mock };
  let dataSource: ReturnType<typeof createDataSourceMock>;
  let service: ChildrenService;

  beforeEach(() => {
    children = createRepositoryMock();
    children.save.mockImplementation(async (c: Child) => Object.assign({ id: CHILD_ID }, c));
    links = createRepositoryMock();
    classes = createRepositoryMock();
    assignments = createRepositoryMock();
    users = createRepositoryMock();
    auditLogs = { record: jest.fn().mockResolvedValue(undefined) };
    dataSource = createDataSourceMock(
      new Map<unknown, RepositoryMock>([
        [Child, children],
        [ChildParent, links],
        [Classroom, classes],
        [ClassTeacher, assignments],
        [User, users],
      ]),
    );
    service = new ChildrenService(
      children as unknown as Repository<Child>,
      links as unknown as Repository<ChildParent>,
      dataSource as unknown as DataSource,
      auditLogs as unknown as AuditLogsService,
    );
  });

  describe('create', () => {
    it('UT-CHILD-01 tạo trẻ hợp lệ → trạng thái mặc định đang học, địa chỉ được trim, ghi audit log', async () => {
      classes.findOne.mockResolvedValue(activeClass); // khóa lớp khi tạo
      classes.findOneBy.mockResolvedValue(activeClass); // lấy tên lớp cho response
      const result = await service.create(childDto, MANAGER, IP);

      expect(children.create).toHaveBeenCalledWith(expect.objectContaining({ address: 'Hà Nội', status: 'ACTIVE', classId: CLASS_ID, avatarUrl: null }));
      expect(result).toMatchObject({ id: CHILD_ID, status: 'ACTIVE', className: 'Lá 1', parents: [] });
      expect(auditLogs.record.mock.calls[0][1]).toMatchObject({ action: 'CREATE_CHILD', resourceType: 'child', resourceId: CHILD_ID });
    });

    it.each([
      ['ngày không tồn tại', '2023-02-30'],
      ['ngày trong tương lai', '2999-01-01'],
      ['tháng 13', '2023-13-01'],
    ])('UT-CHILD-01b ngày sinh không hợp lệ (%s) → 400, không đọc database', async (_case, dateOfBirth) => {
      expectHttpError(
        await getError(() => service.create({ ...childDto, dateOfBirth }, MANAGER, IP)),
        BadRequestException,
        'INVALID_DATE_OF_BIRTH',
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it.each(['ADMIN', 'TEACHER', 'PARENT', 'MEDICAL_STAFF'] as const)('UT-CHILD-01c vai trò %s không được tạo hồ sơ trẻ → 403', async (role) => {
      expectHttpError(await getError(() => service.create(childDto, { ...MANAGER, role }, IP)), ForbiddenException, 'MANAGER_ONLY');
    });

    it.each([
      ['lớp không tồn tại', null],
      ['lớp đã đóng', { ...activeClass, status: 'CLOSED' }],
    ])('UT-CHILD-02 xếp vào %s → 404, không lưu trẻ', async (_case, found) => {
      classes.findOne.mockResolvedValue(found);
      expectHttpError(await getError(() => service.create(childDto, MANAGER, IP)), NotFoundException, 'CLASS_NOT_AVAILABLE');
      expect(children.save).not.toHaveBeenCalled();
    });

    it('UT-CHILD-07 lỗi giữa chừng (ghi audit log thất bại) → lỗi được ném ra khỏi transaction để rollback', async () => {
      classes.findOne.mockResolvedValue(activeClass);
      const failure = new Error('audit insert failed');
      auditLogs.record.mockRejectedValue(failure);

      await expect(service.create(childDto, MANAGER, IP)).rejects.toBe(failure);
      // Ghi trẻ và ghi audit đều chạy bằng manager của cùng một transaction.
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(auditLogs.record.mock.calls[0][0]).toBe(dataSource.manager);
    });
  });

  describe('linkParent', () => {
    beforeEach(() => {
      children.findOneBy.mockResolvedValue(makeChild());
      users.findOneBy.mockResolvedValue(activeParent);
    });

    it.each(['FATHER', 'MOTHER', 'GUARDIAN'] as const)('UT-CHILD-03 liên kết phụ huynh với quan hệ %s', async (relationship) => {
      const result = await service.linkParent(CHILD_ID, { parentUserId: PARENT.id, relationship }, MANAGER, IP);
      expect(result).toEqual({ childId: CHILD_ID, parentUserId: PARENT.id, relationship });
      expect(links.save).toHaveBeenCalledWith(expect.objectContaining({ childId: CHILD_ID, parentUserId: PARENT.id, relationship }));
      expect(auditLogs.record.mock.calls[0][1]).toMatchObject({ action: 'LINK_PARENT', newValue: { parentUserId: PARENT.id, relationship } });
    });

    it.each(['UNCLE', 'father', ''])('UT-CHILD-04 quan hệ không hợp lệ %j → 400', async (relationship) => {
      expect(await invalidFields(LinkParentDto, { parentUserId: PARENT.id, relationship })).toEqual(['relationship']);
    });

    it.each([
      ['tài khoản giáo viên', { ...activeParent, role: 'TEACHER' }],
      ['phụ huynh bị khóa', { ...activeParent, status: 'LOCKED' }],
      ['tài khoản không tồn tại', null],
    ])('UT-CHILD-05 liên kết %s → 400 INVALID_PARENT, không lưu', async (_case, found) => {
      users.findOneBy.mockResolvedValue(found);
      expectHttpError(
        await getError(() => service.linkParent(CHILD_ID, { parentUserId: PARENT.id, relationship: 'MOTHER' }, MANAGER, IP)),
        BadRequestException,
        'INVALID_PARENT',
      );
      expect(links.save).not.toHaveBeenCalled();
    });

    it('UT-CHILD-06 liên kết trùng → 409 (cả khi kiểm tra trước và khi DB báo unique violation)', async () => {
      links.exist.mockResolvedValue(true);
      const dto = { parentUserId: PARENT.id, relationship: 'MOTHER' as const };
      expectHttpError(await getError(() => service.linkParent(CHILD_ID, dto, MANAGER, IP)), ConflictException, 'PARENT_ALREADY_LINKED');
      expect(links.save).not.toHaveBeenCalled();

      links.exist.mockResolvedValue(false);
      links.save.mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505' }));
      expectHttpError(await getError(() => service.linkParent(CHILD_ID, dto, MANAGER, IP)), ConflictException, 'PARENT_ALREADY_LINKED');
    });

    it('UT-CHILD-06b liên kết cho trẻ không tồn tại → 404', async () => {
      children.findOneBy.mockResolvedValue(null);
      expectHttpError(
        await getError(() => service.linkParent(CHILD_ID, { parentUserId: PARENT.id, relationship: 'MOTHER' }, MANAGER, IP)),
        NotFoundException,
        'CHILD_NOT_FOUND',
      );
    });
  });

  describe('update', () => {
    it('UT-CHILD-08 ngừng theo học chỉ đổi trạng thái, không xóa; audit log ghi WITHDRAW_CHILD', async () => {
      children.findOne.mockResolvedValue(makeChild());
      const result = await service.update(CHILD_ID, { status: 'WITHDRAWN' }, MANAGER, IP);

      expect(result.status).toBe('WITHDRAWN');
      expect(children.remove).not.toHaveBeenCalled();
      expect(auditLogs.record.mock.calls[0][1]).toMatchObject({
        action: 'WITHDRAW_CHILD',
        oldValue: { status: 'ACTIVE' },
        newValue: { status: 'WITHDRAWN' },
      });
    });

    // Lỗi đã biết: CreateChildDto bắt buộc tên 1–150 ký tự nhưng UpdateChildDto chỉ có @MaxLength(150),
    // nên PATCH { name: "   " } lưu tên rỗng. Khi đã sửa, test này sẽ báo fail → đổi it.failing thành it.
    it.failing('UT-CHILD-08d sửa tên trẻ thành chuỗi rỗng / toàn dấu cách → 400', async () => {
      expect(await invalidFields(UpdateChildDto, { name: '   ' })).toEqual(['name']);
    });

    it('UT-CHILD-08b chuyển sang lớp đã đóng → 404, trẻ giữ lớp cũ', async () => {
      const child = makeChild();
      children.findOne.mockResolvedValue(child);
      classes.findOne.mockResolvedValue({ ...activeClass, id: 'c3000000-0000-4000-8000-000000000003', status: 'CLOSED' });
      expectHttpError(
        await getError(() => service.update(CHILD_ID, { classId: 'c3000000-0000-4000-8000-000000000003' }, MANAGER, IP)),
        NotFoundException,
        'CLASS_NOT_AVAILABLE',
      );
      expect(children.save).not.toHaveBeenCalled();
      expect(child.classId).toBe(CLASS_ID);
    });

    it('UT-CHILD-08c cập nhật rỗng → 400 EMPTY_UPDATE', async () => {
      expectHttpError(await getError(() => service.update(CHILD_ID, {}, MANAGER, IP)), BadRequestException, 'EMPTY_UPDATE');
    });
  });

  describe('getOne (quyền sở hữu)', () => {
    beforeEach(() => children.findOneBy.mockResolvedValue(makeChild()));

    it('UT-CHILD-09 đúng phụ huynh → xem được; phụ huynh khác → 403 CHILD_ACCESS_DENIED', async () => {
      links.exist.mockResolvedValue(true);
      await expect(service.getOne(CHILD_ID, PARENT)).resolves.toMatchObject({ id: CHILD_ID });
      expect(links.exist).toHaveBeenCalledWith({ where: { childId: CHILD_ID, parentUserId: PARENT.id } });

      links.exist.mockResolvedValue(false);
      expectHttpError(await getError(() => service.getOne(CHILD_ID, PARENT)), ForbiddenException, 'CHILD_ACCESS_DENIED');
    });

    it('UT-CHILD-09b giáo viên của lớp → xem được; giáo viên lớp khác → 403', async () => {
      assignments.exist.mockResolvedValue(true);
      await expect(service.getOne(CHILD_ID, TEACHER)).resolves.toMatchObject({ id: CHILD_ID });
      expect(assignments.exist).toHaveBeenCalledWith({ where: { classId: CLASS_ID, teacherUserId: TEACHER.id } });

      assignments.exist.mockResolvedValue(false);
      expectHttpError(await getError(() => service.getOne(CHILD_ID, TEACHER)), ForbiddenException, 'CHILD_ACCESS_DENIED');
    });

    it.each(['ADMIN', 'MEDICAL_STAFF'] as const)('UT-CHILD-09c vai trò %s hiện không xem được hồ sơ trẻ → 403', async (role) => {
      expectHttpError(await getError(() => service.getOne(CHILD_ID, { ...MANAGER, role })), ForbiddenException, 'CHILD_ACCESS_DENIED');
    });

    it('UT-CHILD-09d trẻ không tồn tại → 404', async () => {
      children.findOneBy.mockResolvedValue(null);
      expectHttpError(await getError(() => service.getOne(CHILD_ID, MANAGER)), NotFoundException, 'CHILD_NOT_FOUND');
    });
  });

  describe('list', () => {
    const query = (overrides: Partial<ListChildrenQueryDto> = {}) => Object.assign(new ListChildrenQueryDto(), overrides);

    it('UT-CHILD-10 danh sách trẻ có phân trang, lọc theo lớp, trạng thái, tên', async () => {
      const qb = createQueryBuilderMock([], 41);
      children.createQueryBuilder.mockReturnValue(qb);

      const result = await service.list(query({ classId: CLASS_ID, status: 'ACTIVE', query: 'AN', page: 3, limit: 20 }), MANAGER);

      const clauses = whereClauses(qb);
      expect(clauses).toContain(`"classId":"${CLASS_ID}"`);
      expect(clauses).toContain('"status":"ACTIVE"');
      expect(clauses).toContain('"search":"%an%"');
      expect(qb.skip).toHaveBeenCalledWith(40);
      expect(result.pageInfo).toEqual({ page: 3, limit: 20, totalItems: 41, totalPages: 3 });
    });

    it.each([
      [PARENT, ChildParent, 'parentLink'],
      [TEACHER, ClassTeacher, 'assignment'],
    ])('UT-CHILD-10b %s.role chỉ thấy trẻ trong phạm vi của mình', async (actor, entity, alias) => {
      const qb = createQueryBuilderMock();
      children.createQueryBuilder.mockReturnValue(qb);
      await service.list(query(), actor);
      expect(qb.innerJoin).toHaveBeenCalledWith(entity, alias, expect.any(String), { actorId: actor.id });
    });

    it.each(['ADMIN', 'MEDICAL_STAFF'] as const)('UT-CHILD-10c vai trò %s không xem được danh sách trẻ → 403', async (role) => {
      children.createQueryBuilder.mockReturnValue(createQueryBuilderMock());
      expectHttpError(await getError(() => service.list(query(), { ...MANAGER, role })), ForbiddenException, 'CHILD_ACCESS_DENIED');
    });
  });
});
