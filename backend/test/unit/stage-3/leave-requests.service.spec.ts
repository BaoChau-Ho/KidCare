import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  createDataSourceMock,
  createQueryBuilderMock,
  createRepositoryMock,
  expectHttpError,
  getError,
  RepositoryMock,
  whereClauses,
} from '../../helpers/mocks';
import { AccessActor, ChildAccessService } from '../../../src/access/child-access.service';
import { AuditLogsService } from '../../../src/audit-logs/audit-logs.service';
import { ChildParent } from '../../../src/children/child-parent.entity';
import { Child } from '../../../src/children/child.entity';
import { ClassTeacher } from '../../../src/classes/class-teacher.entity';
import { Classroom } from '../../../src/classes/class.entity';
import { DomainEventPublisher } from '../../../src/common/domain-events/domain-event.publisher';
import { addDays } from '../../../src/common/school-time';
import { LeaveRequest } from '../../../src/leave-requests/leave-request.entity';
import { LeaveRequestsService } from '../../../src/leave-requests/leave-requests.service';
import { User } from '../../../src/users/user.entity';

// Giai đoạn 3 — UC-08 đơn xin nghỉ: phụ huynh gửi / rút đơn, giáo viên hoặc quản lý duyệt / từ chối.
// "Hôm nay" được cố định là 09/11/2026 giờ Việt Nam.
// Danh sách test và tiến độ: backend/test/README.md.

const TODAY = '2026-11-09';
const NOW = new Date(`${TODAY}T10:00:00+07:00`);
const TOMORROW = addDays(TODAY, 1);
const IP = '10.0.0.1';

const CLASS_ID = 'c0000000-0000-4000-8000-000000000001';
const CHILD_ID = 'k0000000-0000-4000-8000-000000000001';
const LEAVE_ID = 'l0000000-0000-4000-8000-000000000001';

const actor = (role: AccessActor['role'], id: string): AccessActor => ({ id, email: `${role.toLowerCase()}@demo.com`, fullName: `Người dùng ${role}`, role });
const PARENT = actor('PARENT', 'p0000000-0000-4000-8000-000000000001');
const TEACHER = actor('TEACHER', 't0000000-0000-4000-8000-000000000001');
const MANAGER = actor('MANAGER', 'm0000000-0000-4000-8000-000000000001');

const makeChild = (overrides: Partial<Child> = {}) =>
  ({ id: CHILD_ID, name: 'Minh An', classId: CLASS_ID, status: 'ACTIVE', ...overrides }) as Child;

const makeLeave = (overrides: Partial<LeaveRequest> = {}): LeaveRequest =>
  ({
    id: LEAVE_ID,
    childId: CHILD_ID,
    parentUserId: PARENT.id,
    fromDate: TOMORROW,
    toDate: addDays(TODAY, 2),
    reason: 'Bé bị sốt',
    status: 'PENDING',
    decidedByUserId: null,
    decidedAt: null,
    decisionReason: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }) as LeaveRequest;

describe('GĐ3 · LeaveRequestsService', () => {
  let leaves: RepositoryMock;
  let children: RepositoryMock;
  let classes: RepositoryMock;
  let users: RepositoryMock;
  let assignments: RepositoryMock;
  let links: RepositoryMock;
  let auditLogs: { record: jest.Mock };
  let events: { publish: jest.Mock };
  let dataSource: ReturnType<typeof createDataSourceMock>;
  let service: LeaveRequestsService;

  beforeAll(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
  });
  afterAll(() => jest.useRealTimers());

  beforeEach(() => {
    leaves = createRepositoryMock();
    leaves.save.mockImplementation(async (leave: LeaveRequest) =>
      Object.assign({ id: LEAVE_ID, createdAt: NOW, updatedAt: NOW, decidedByUserId: null, decidedAt: null, decisionReason: null }, leave),
    );
    leaves.createQueryBuilder.mockReturnValue(createQueryBuilderMock([])); // mặc định không có đơn trùng
    children = createRepositoryMock();
    children.findOne.mockResolvedValue(makeChild());
    children.findOneBy.mockResolvedValue(makeChild());
    children.findBy.mockResolvedValue([makeChild()]);
    classes = createRepositoryMock();
    classes.findBy.mockResolvedValue([{ id: CLASS_ID, name: 'Mầm 1' }]);
    users = createRepositoryMock();
    users.findBy.mockResolvedValue([
      { id: PARENT.id, fullName: 'Phụ huynh A', email: 'parent@demo.com' },
      { id: TEACHER.id, fullName: 'Cô Lan', email: 'teacher@demo.com' },
    ]);
    assignments = createRepositoryMock();
    assignments.exist.mockResolvedValue(true); // TEACHER phụ trách lớp của trẻ
    links = createRepositoryMock();
    links.exist.mockResolvedValue(true); // PARENT đã liên kết với trẻ
    auditLogs = { record: jest.fn().mockResolvedValue(undefined) };
    events = { publish: jest.fn() };
    dataSource = createDataSourceMock(
      new Map<unknown, RepositoryMock>([
        [LeaveRequest, leaves],
        [Child, children],
        [ClassTeacher, assignments],
        [ChildParent, links],
      ]),
    );
    service = new LeaveRequestsService(
      leaves as unknown as Repository<LeaveRequest>,
      children as unknown as Repository<Child>,
      classes as unknown as Repository<Classroom>,
      users as unknown as Repository<User>,
      dataSource as unknown as DataSource,
      new ChildAccessService(dataSource as unknown as DataSource),
      auditLogs as unknown as AuditLogsService,
      events as unknown as DomainEventPublisher,
    );
  });

  const dto = (overrides: Partial<{ fromDate: string; toDate: string; reason: string }> = {}) => ({
    childId: CHILD_ID,
    fromDate: TOMORROW,
    toDate: addDays(TODAY, 2),
    reason: 'Bé bị sốt',
    ...overrides,
  });

  /* ------------------------------------------------------------------ create */
  describe('create (phụ huynh gửi đơn)', () => {
    it('UT-LEAVE-01 đơn hợp lệ → PENDING, gắn phụ huynh đang đăng nhập; trả kèm tên trẻ, lớp, phụ huynh', async () => {
      const res = await service.create(dto(), PARENT, IP);
      expect(leaves.save).toHaveBeenCalledWith(
        expect.objectContaining({ childId: CHILD_ID, parentUserId: PARENT.id, fromDate: TOMORROW, toDate: addDays(TODAY, 2), status: 'PENDING' }),
      );
      expect(res).toMatchObject({ id: LEAVE_ID, status: 'PENDING', childName: 'Minh An', className: 'Mầm 1', parentName: 'Phụ huynh A', decidedByName: null });
    });

    it('UT-LEAVE-02 đơn cho đúng hôm nay được nhận', async () => {
      await expect(service.create(dto({ fromDate: TODAY, toDate: TODAY }), PARENT, IP)).resolves.toMatchObject({ status: 'PENDING' });
    });

    it.each(['TEACHER', 'MANAGER', 'MEDICAL_STAFF', 'ADMIN'] as const)('UT-LEAVE-03 vai trò %s không gửi được đơn → 403', async (role) => {
      expectHttpError(await getError(() => service.create(dto(), actor(role, 'x'), IP)), ForbiddenException, 'ROLE_NOT_ALLOWED');
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it.each([
      ['ngày bắt đầu đã qua', { fromDate: addDays(TODAY, -1) }, 'fromDate'],
      ['ngày kết thúc trước ngày bắt đầu', { fromDate: addDays(TODAY, 3), toDate: TOMORROW }, 'toDate'],
      ['ngày bắt đầu không có thật', { fromDate: '2027-02-30' }, 'fromDate'],
      ['ngày kết thúc không có thật', { toDate: '2026-11-31' }, 'toDate'],
      ['đơn dài hơn 366 ngày', { toDate: addDays(TOMORROW, 400) }, 'toDate'],
    ])('UT-LEAVE-04 %s → 400 ở trường %s, không mở transaction', async (_label, patch, field) => {
      const error = await getError(() => service.create(dto(patch), PARENT, IP));
      expectHttpError(error, BadRequestException, 'VALIDATION_ERROR');
      expect((error as BadRequestException).getResponse()).toMatchObject({ field });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('UT-LEAVE-05 đơn đúng 366 ngày (tính cả ngày đầu và cuối) được nhận', async () => {
      await expect(service.create(dto({ toDate: addDays(TOMORROW, 365) }), PARENT, IP)).resolves.toBeDefined();
    });

    // Lỗi lệch một ngày (README vấn đề #22): service so daysBetween(from, to) > 366, nhưng daysBetween không tính ngày đầu,
    // nên đơn 367 ngày vẫn lọt qua dù thông báo lỗi ghi "tối đa 366 ngày". Sửa xong thì đổi it.failing thành it.
    it.failing('UT-LEAVE-05b đơn 367 ngày (tính cả ngày đầu và cuối) → 400', async () => {
      expectHttpError(await getError(() => service.create(dto({ toDate: addDays(TOMORROW, 366) }), PARENT, IP)), BadRequestException, 'VALIDATION_ERROR');
    });

    it('UT-LEAVE-06 trẻ không tồn tại → 404; khóa dòng của trẻ để các đơn gửi cùng lúc được kiểm tra trùng tuần tự', async () => {
      children.findOne.mockResolvedValue(null);
      expectHttpError(await getError(() => service.create(dto(), PARENT, IP)), NotFoundException, 'CHILD_NOT_FOUND');
      expect(children.findOne).toHaveBeenCalledWith({ where: { id: CHILD_ID }, lock: { mode: 'pessimistic_write' } });
    });

    it('UT-LEAVE-07 phụ huynh chưa liên kết với trẻ → 403 CHILD_ACCESS_DENIED, không lưu', async () => {
      links.exist.mockResolvedValue(false);
      expectHttpError(await getError(() => service.create(dto(), PARENT, IP)), ForbiddenException, 'CHILD_ACCESS_DENIED');
      expect(leaves.save).not.toHaveBeenCalled();
    });

    it('UT-LEAVE-08 trẻ đã nghỉ học → 409 CHILD_NOT_ACTIVE', async () => {
      children.findOne.mockResolvedValue(makeChild({ status: 'WITHDRAWN' }));
      expectHttpError(await getError(() => service.create(dto(), PARENT, IP)), ConflictException, 'CHILD_NOT_ACTIVE');
      expect(leaves.save).not.toHaveBeenCalled();
    });

    it('UT-LEAVE-09 trùng với đơn PENDING/APPROVED → 409 LEAVE_OVERLAP, thông báo nêu khoảng ngày đơn cũ; truy vấn đúng điều kiện giao nhau', async () => {
      const qb = createQueryBuilderMock([makeLeave({ fromDate: '2026-11-10', toDate: '2026-11-12', status: 'APPROVED' })]);
      leaves.createQueryBuilder.mockReturnValue(qb);
      const error = await getError(() => service.create(dto(), PARENT, IP));
      expectHttpError(error, ConflictException, 'LEAVE_OVERLAP');
      expect((error as ConflictException).getResponse()).toMatchObject({ message: expect.stringContaining('10/11/2026 - 12/11/2026') });
      expect(leaves.save).not.toHaveBeenCalled();
      // Hai khoảng [a1, b1] và [a2, b2] giao nhau khi a1 <= b2 và b1 >= a2; đơn REJECTED/CANCELLED không tính
      expect(whereClauses(qb)).toContain("leave.status IN ('PENDING', 'APPROVED')");
      expect(qb.andWhere).toHaveBeenCalledWith('leave.fromDate <= :toDate AND leave.toDate >= :fromDate', { fromDate: TOMORROW, toDate: addDays(TODAY, 2) });
    });

    it('UT-LEAVE-10 hai đơn trùng gửi cùng lúc: database báo exclusion violation (23P01) → 409 LEAVE_OVERLAP, không phải 500', async () => {
      dataSource.transaction.mockRejectedValueOnce({ driverError: { code: '23P01' } });
      expectHttpError(await getError(() => service.create(dto(), PARENT, IP)), ConflictException, 'LEAVE_OVERLAP');
      expect(events.publish).not.toHaveBeenCalled();
    });

    it('UT-LEAVE-11 lỗi khác (ghi audit lỗi) → ném nguyên lỗi để rollback, không phát sự kiện', async () => {
      const failure = new Error('audit down');
      auditLogs.record.mockRejectedValue(failure);
      expect(await getError(() => service.create(dto(), PARENT, IP))).toBe(failure);
      expect(events.publish).not.toHaveBeenCalled();
    });

    it('UT-LEAVE-12 thành công: audit trong transaction; sự kiện leave-request.created có lớp của trẻ để báo đúng giáo viên', async () => {
      await service.create(dto(), PARENT, IP);
      expect(auditLogs.record).toHaveBeenCalledWith(
        dataSource.manager,
        expect.objectContaining({
          actorUserId: PARENT.id,
          action: 'CREATE_LEAVE_REQUEST',
          resourceType: 'leave_request',
          resourceId: LEAVE_ID,
          oldValue: null,
          newValue: { childId: CHILD_ID, fromDate: TOMORROW, toDate: addDays(TODAY, 2), status: 'PENDING' },
          ipAddress: IP,
        }),
      );
      expect(events.publish).toHaveBeenCalledWith('leave-request.created', {
        leaveRequestId: LEAVE_ID,
        childId: CHILD_ID,
        classId: CLASS_ID,
        parentUserId: PARENT.id,
        fromDate: TOMORROW,
        toDate: addDays(TODAY, 2),
      });
    });

    it('UT-LEAVE-13 lý do không bị ghi vào audit log (tránh lưu thông tin sức khỏe trong log)', async () => {
      await service.create(dto({ reason: 'Bé bị sốt xuất huyết' }), PARENT, IP);
      expect(JSON.stringify(auditLogs.record.mock.calls)).not.toContain('sốt xuất huyết');
    });
  });

  /* -------------------------------------------------------------------- list */
  describe('list (danh sách theo phạm vi)', () => {
    let qb: ReturnType<typeof createQueryBuilderMock>;
    const query = { page: 1, limit: 20 };

    beforeEach(() => {
      qb = createQueryBuilderMock([makeLeave()], 1);
      leaves.createQueryBuilder.mockReturnValue(qb);
    });

    it.each(['MEDICAL_STAFF', 'ADMIN'] as const)('UT-LEAVE-20 vai trò %s → 403, không truy vấn', async (role) => {
      expectHttpError(await getError(() => service.list(query, actor(role, 'x'))), ForbiddenException, 'ROLE_NOT_ALLOWED');
      expect(leaves.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('UT-LEAVE-21 phụ huynh chỉ thấy đơn do chính mình gửi', async () => {
      await service.list(query, PARENT);
      expect(qb.andWhere).toHaveBeenCalledWith('leave.parentUserId = :actorId', { actorId: PARENT.id });
    });

    it('UT-LEAVE-22 giáo viên chỉ thấy đơn của trẻ thuộc lớp mình phụ trách', async () => {
      await service.list(query, TEACHER);
      expect(qb.innerJoin).toHaveBeenCalledWith(
        ClassTeacher,
        'assignment',
        'assignment.classId = child.classId AND assignment.teacherUserId = :actorId',
        { actorId: TEACHER.id },
      );
      expect(whereClauses(qb)).not.toContain('parentUserId');
    });

    it('UT-LEAVE-23 quản lý thấy tất cả: không có điều kiện phạm vi', async () => {
      await service.list(query, MANAGER);
      const clauses = whereClauses(qb);
      expect(clauses).not.toContain('parentUserId');
      expect(clauses).not.toContain('assignment');
    });

    it('UT-LEAVE-24 lọc theo trạng thái, trẻ, lớp; phân trang và tổng số trang', async () => {
      qb.getManyAndCount.mockResolvedValue([[makeLeave()], 41]);
      const res = await service.list({ status: 'PENDING', childId: CHILD_ID, classId: CLASS_ID, page: 3, limit: 20 }, MANAGER);
      expect(qb.andWhere).toHaveBeenCalledWith('leave.status = :status', { status: 'PENDING' });
      expect(qb.andWhere).toHaveBeenCalledWith('leave.childId = :childId', { childId: CHILD_ID });
      expect(qb.andWhere).toHaveBeenCalledWith('child.classId = :classId', { classId: CLASS_ID });
      expect(qb.skip).toHaveBeenCalledWith(40);
      expect(res.pageInfo).toEqual({ page: 3, limit: 20, totalItems: 41, totalPages: 3 });
    });

    it('UT-LEAVE-25 gắn tên theo lô: 3 đơn chỉ tốn 1 truy vấn trẻ, 1 lớp, 1 người dùng (không N+1)', async () => {
      qb.getManyAndCount.mockResolvedValue([[makeLeave({ id: 'l1' }), makeLeave({ id: 'l2' }), makeLeave({ id: 'l3' })], 3]);
      const res = await service.list(query, MANAGER);
      expect(res.items).toHaveLength(3);
      expect(children.findBy).toHaveBeenCalledTimes(1);
      expect(classes.findBy).toHaveBeenCalledTimes(1);
      expect(users.findBy).toHaveBeenCalledTimes(1);
    });

    it('UT-LEAVE-26 danh sách rỗng → không truy vấn thêm; phụ huynh không có họ tên → hiện email', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      expect((await service.list(query, MANAGER)).items).toEqual([]);
      expect(children.findBy).not.toHaveBeenCalled();

      qb.getManyAndCount.mockResolvedValue([[makeLeave()], 1]);
      users.findBy.mockResolvedValue([{ id: PARENT.id, fullName: null, email: 'parent@demo.com' }]);
      expect((await service.list(query, MANAGER)).items[0].parentName).toBe('parent@demo.com');
    });
  });

  /* ------------------------------------------------------- approve / reject */
  describe('approve / reject (giáo viên, quản lý xử lý đơn)', () => {
    beforeEach(() => {
      leaves.findOne.mockResolvedValue(makeLeave());
    });

    it('UT-LEAVE-30 giáo viên đúng lớp duyệt: lưu trạng thái, người duyệt, thời điểm; lý do để trống', async () => {
      const res = await service.approve(LEAVE_ID, TEACHER, IP);
      expect(leaves.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'APPROVED', decidedByUserId: TEACHER.id, decidedAt: NOW, decisionReason: null }),
      );
      expect(res).toMatchObject({ status: 'APPROVED', decidedByName: 'Cô Lan', decidedAt: NOW.toISOString() });
      expect(auditLogs.record).toHaveBeenCalledWith(
        dataSource.manager,
        expect.objectContaining({ action: 'APPROVE_LEAVE_REQUEST', oldValue: { status: 'PENDING' }, newValue: { status: 'APPROVED' } }),
      );
    });

    it('UT-LEAVE-31 từ chối lưu lý do; sự kiện leave-request.decided gửi lý do cho phụ huynh', async () => {
      const res = await service.reject(LEAVE_ID, 'Trùng lịch kiểm tra', MANAGER, IP);
      expect(res).toMatchObject({ status: 'REJECTED', decisionReason: 'Trùng lịch kiểm tra' });
      expect(auditLogs.record).toHaveBeenCalledWith(dataSource.manager, expect.objectContaining({ action: 'REJECT_LEAVE_REQUEST' }));
      expect(events.publish).toHaveBeenCalledWith('leave-request.decided', {
        leaveRequestId: LEAVE_ID,
        childId: CHILD_ID,
        classId: CLASS_ID,
        parentUserId: PARENT.id,
        decision: 'REJECTED',
        decidedByUserId: MANAGER.id,
        fromDate: TOMORROW,
        toDate: addDays(TODAY, 2),
        reason: 'Trùng lịch kiểm tra',
      });
    });

    it('UT-LEAVE-32 khóa dòng đơn khi xử lý để hai người duyệt cùng lúc chỉ một người thành công', async () => {
      await service.approve(LEAVE_ID, TEACHER, IP);
      expect(leaves.findOne).toHaveBeenCalledWith({ where: { id: LEAVE_ID }, lock: { mode: 'pessimistic_write' } });
    });

    it.each(['APPROVED', 'REJECTED', 'CANCELLED'] as const)('UT-LEAVE-33 đơn đang %s → 409 ALREADY_PROCESSED, không lưu, không phát sự kiện', async (status) => {
      leaves.findOne.mockResolvedValue(makeLeave({ status }));
      expectHttpError(await getError(() => service.approve(LEAVE_ID, TEACHER, IP)), ConflictException, 'ALREADY_PROCESSED');
      expect(leaves.save).not.toHaveBeenCalled();
      expect(events.publish).not.toHaveBeenCalled();
    });

    it('UT-LEAVE-34 giáo viên lớp khác → 403 CLASS_ACCESS_DENIED, đơn giữ nguyên', async () => {
      assignments.exist.mockResolvedValue(false);
      expectHttpError(await getError(() => service.reject(LEAVE_ID, 'x', TEACHER, IP)), ForbiddenException, 'CLASS_ACCESS_DENIED');
      expect(leaves.save).not.toHaveBeenCalled();
    });

    it('UT-LEAVE-35 đơn không tồn tại → 404 LEAVE_REQUEST_NOT_FOUND', async () => {
      leaves.findOne.mockResolvedValue(null);
      expectHttpError(await getError(() => service.approve(LEAVE_ID, TEACHER, IP)), NotFoundException, 'LEAVE_REQUEST_NOT_FOUND');
    });

    it.each(['PARENT', 'MEDICAL_STAFF', 'ADMIN'] as const)('UT-LEAVE-36 vai trò %s không duyệt được → 403, không mở transaction', async (role) => {
      expectHttpError(await getError(() => service.approve(LEAVE_ID, actor(role, 'x'), IP)), ForbiddenException, 'ROLE_NOT_ALLOWED');
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('UT-LEAVE-37 lỗi giữa chừng (ghi audit lỗi) → ném lỗi để rollback, không phát sự kiện', async () => {
      const failure = new Error('audit down');
      auditLogs.record.mockRejectedValue(failure);
      expect(await getError(() => service.approve(LEAVE_ID, TEACHER, IP))).toBe(failure);
      expect(events.publish).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------ cancel */
  describe('cancel (phụ huynh rút đơn)', () => {
    beforeEach(() => {
      leaves.findOne.mockResolvedValue(makeLeave());
    });

    it('UT-LEAVE-40 rút đơn PENDING của mình → CANCELLED; audit ghi trước/sau', async () => {
      const res = await service.cancel(LEAVE_ID, PARENT, IP);
      expect(res.status).toBe('CANCELLED');
      expect(auditLogs.record).toHaveBeenCalledWith(
        dataSource.manager,
        expect.objectContaining({ action: 'CANCEL_LEAVE_REQUEST', oldValue: { status: 'PENDING' }, newValue: { status: 'CANCELLED' } }),
      );
    });

    it('UT-LEAVE-41 chỉ tìm đơn trong số đơn của chính phụ huynh; đơn của người khác → 404 (không lộ là đơn có tồn tại)', async () => {
      leaves.findOne.mockResolvedValue(null);
      expectHttpError(await getError(() => service.cancel(LEAVE_ID, PARENT, IP)), NotFoundException, 'LEAVE_REQUEST_NOT_FOUND');
      expect(leaves.findOne).toHaveBeenCalledWith({ where: { id: LEAVE_ID, parentUserId: PARENT.id }, lock: { mode: 'pessimistic_write' } });
    });

    it.each(['APPROVED', 'REJECTED', 'CANCELLED'] as const)('UT-LEAVE-42 đơn đang %s không rút được → 409 ALREADY_PROCESSED', async (status) => {
      leaves.findOne.mockResolvedValue(makeLeave({ status }));
      expectHttpError(await getError(() => service.cancel(LEAVE_ID, PARENT, IP)), ConflictException, 'ALREADY_PROCESSED');
      expect(leaves.save).not.toHaveBeenCalled();
    });

    it.each(['TEACHER', 'MANAGER'] as const)('UT-LEAVE-43 vai trò %s không rút được đơn → 403', async (role) => {
      expectHttpError(await getError(() => service.cancel(LEAVE_ID, actor(role, 'x'), IP)), ForbiddenException, 'ROLE_NOT_ALLOWED');
    });

    // Hành vi hiện tại, cần nhóm chốt (README vấn đề #24): rút đơn không phát sự kiện,
    // nên khi có Stage 6 giáo viên sẽ không được báo là phụ huynh đã rút đơn.
    it('UT-LEAVE-44 rút đơn hiện không phát sự kiện nào (hành vi hiện tại)', async () => {
      await service.cancel(LEAVE_ID, PARENT, IP);
      expect(events.publish).not.toHaveBeenCalled();
    });
  });
});
