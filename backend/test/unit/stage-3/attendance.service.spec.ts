import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  createDataSourceMock,
  createQueryBuilderMock,
  createRepositoryMock,
  expectHttpError,
  getError,
  RepositoryMock,
} from '../../helpers/mocks';
import { AccessActor, ChildAccessService } from '../../../src/access/child-access.service';
import { Attendance } from '../../../src/attendance/attendance.entity';
import { AttendanceService } from '../../../src/attendance/attendance.service';
import { AuditLogsService } from '../../../src/audit-logs/audit-logs.service';
import { ChildParent } from '../../../src/children/child-parent.entity';
import { Child } from '../../../src/children/child.entity';
import { ClassTeacher } from '../../../src/classes/class-teacher.entity';
import { Classroom } from '../../../src/classes/class.entity';
import { DomainEventPublisher } from '../../../src/common/domain-events/domain-event.publisher';
import { LeaveRequest } from '../../../src/leave-requests/leave-request.entity';

// Giai đoạn 3 — UC-06 điểm danh và UC-07 phụ huynh xem tình hình của con.
// Giờ chuẩn mặc định: vào lớp 08:00, tan học 16:00, múi giờ Asia/Ho_Chi_Minh (UTC+7).
// "Bây giờ" được cố định là 10:00 ngày 09/11/2026 giờ Việt Nam để kết quả không phụ thuộc lúc chạy test.
// Danh sách test và tiến độ: backend/test/README.md.

const TODAY = '2026-11-09';
const YESTERDAY = '2026-11-08';
const TOMORROW = '2026-11-10';
const NOW = new Date(`${TODAY}T10:00:00+07:00`);
const at = (date: string, hhmm: string) => `${date}T${hhmm}:00+07:00`;
const IP = '10.0.0.1';

const CLASS_ID = 'c0000000-0000-4000-8000-000000000001';
const CHILD_ID = 'k0000000-0000-4000-8000-000000000001';
const RECORD_ID = 'a0000000-0000-4000-8000-000000000001';

const actor = (role: AccessActor['role'], id = 'u0000000-0000-4000-8000-000000000001'): AccessActor => ({
  id,
  email: `${role.toLowerCase()}@demo.com`,
  fullName: `Người dùng ${role}`,
  role,
});
const TEACHER = actor('TEACHER', 't0000000-0000-4000-8000-000000000001');
const MANAGER = actor('MANAGER', 'm0000000-0000-4000-8000-000000000001');
const PARENT = actor('PARENT', 'p0000000-0000-4000-8000-000000000001');

const makeChild = (overrides: Partial<Child> = {}) =>
  ({ id: CHILD_ID, name: 'Minh An', gender: 'MALE', classId: CLASS_ID, status: 'ACTIVE', ...overrides }) as Child;

const makeRecord = (overrides: Partial<Attendance> = {}): Attendance =>
  ({
    id: RECORD_ID,
    childId: CHILD_ID,
    date: TODAY,
    status: 'PRESENT',
    checkInTime: new Date(at(TODAY, '07:50')),
    checkOutTime: null,
    recordedByUserId: TEACHER.id,
    checkedOutByUserId: null,
    createdAt: new Date(at(TODAY, '07:50')),
    updatedAt: new Date(at(TODAY, '07:50')),
    ...overrides,
  }) as Attendance;

describe('GĐ3 · AttendanceService', () => {
  let attendance: RepositoryMock;
  let children: RepositoryMock;
  let classes: RepositoryMock;
  let leaves: RepositoryMock;
  let assignments: RepositoryMock;
  let links: RepositoryMock;
  let auditLogs: { record: jest.Mock };
  let events: { publish: jest.Mock };
  let dataSource: ReturnType<typeof createDataSourceMock>;
  let service: AttendanceService;

  beforeAll(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
  });
  afterAll(() => jest.useRealTimers());

  beforeEach(() => {
    attendance = createRepositoryMock();
    attendance.save.mockImplementation(async (record: Attendance) =>
      Object.assign({ id: RECORD_ID, createdAt: NOW, updatedAt: NOW }, record),
    );
    children = createRepositoryMock();
    classes = createRepositoryMock();
    leaves = createRepositoryMock();
    assignments = createRepositoryMock();
    assignments.exist.mockResolvedValue(true); // mặc định TEACHER được phân công lớp CLASS_ID
    links = createRepositoryMock();
    auditLogs = { record: jest.fn().mockResolvedValue(undefined) };
    events = { publish: jest.fn() };
    dataSource = createDataSourceMock(
      new Map<unknown, RepositoryMock>([
        [Attendance, attendance],
        [Child, children],
        [Classroom, classes],
        [LeaveRequest, leaves],
        [ClassTeacher, assignments],
        [ChildParent, links],
      ]),
    );
    service = new AttendanceService(
      attendance as unknown as Repository<Attendance>,
      children as unknown as Repository<Child>,
      classes as unknown as Repository<Classroom>,
      leaves as unknown as Repository<LeaveRequest>,
      dataSource as unknown as DataSource,
      new ChildAccessService(dataSource as unknown as DataSource),
      auditLogs as unknown as AuditLogsService,
      events as unknown as DomainEventPublisher,
    );
  });

  /* ------------------------------------------------------------------ roster */
  describe('roster (bảng điểm danh của lớp)', () => {
    beforeEach(() => {
      classes.findOneBy.mockResolvedValue({ id: CLASS_ID, name: 'Mầm 1' });
    });

    it.each(['PARENT', 'MEDICAL_STAFF', 'ADMIN'] as const)('UT-ATT-01 vai trò %s → 403 ROLE_NOT_ALLOWED, không truy vấn lớp', async (role) => {
      expectHttpError(await getError(() => service.roster(CLASS_ID, {}, actor(role))), ForbiddenException, 'ROLE_NOT_ALLOWED');
      expect(classes.findOneBy).not.toHaveBeenCalled();
    });

    it('UT-ATT-02 lớp không tồn tại → 404 CLASS_NOT_FOUND', async () => {
      classes.findOneBy.mockResolvedValue(null);
      expectHttpError(await getError(() => service.roster(CLASS_ID, {}, TEACHER)), NotFoundException, 'CLASS_NOT_FOUND');
    });

    it('UT-ATT-03 giáo viên không phụ trách lớp → 403 CLASS_ACCESS_DENIED, không đọc danh sách trẻ', async () => {
      assignments.exist.mockResolvedValue(false);
      expectHttpError(await getError(() => service.roster(CLASS_ID, {}, TEACHER)), ForbiddenException, 'CLASS_ACCESS_DENIED');
      expect(children.find).not.toHaveBeenCalled();
    });

    it('UT-ATT-04 ngày không có thật (30/02) → 400', async () => {
      expectHttpError(await getError(() => service.roster(CLASS_ID, { date: '2026-02-30' }, MANAGER)), BadRequestException, 'VALIDATION_ERROR');
    });

    it('UT-ATT-05 không gửi ngày → lấy hôm nay theo giờ của trường; chỉ lấy trẻ đang học; kèm giờ chuẩn', async () => {
      const result = await service.roster(CLASS_ID, {}, MANAGER);
      expect(result).toMatchObject({ classId: CLASS_ID, className: 'Mầm 1', date: TODAY, settings: { startTime: '08:00', endTime: '16:00' }, items: [] });
      expect(children.find).toHaveBeenCalledWith(expect.objectContaining({ where: { classId: CLASS_ID, status: 'ACTIVE' } }));
    });

    it('UT-ATT-05b lúc 00:30 giờ Việt Nam (17:30 UTC hôm trước) thì "hôm nay" vẫn là ngày theo giờ Việt Nam', async () => {
      jest.setSystemTime(new Date(`${TODAY}T00:30:00+07:00`));
      try {
        expect((await service.roster(CLASS_ID, {}, MANAGER)).date).toBe(TODAY);
      } finally {
        jest.setSystemTime(NOW);
      }
    });

    it('UT-ATT-06 lớp không có trẻ → không truy vấn điểm danh và đơn nghỉ', async () => {
      await service.roster(CLASS_ID, { date: YESTERDAY }, MANAGER);
      expect(attendance.findBy).not.toHaveBeenCalled();
      expect(leaves.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('UT-ATT-07 trạng thái từng trẻ: có bản ghi → theo bản ghi; chưa có + đơn nghỉ đã duyệt → ABSENT, onLeave; chưa có → NOT_CHECKED_IN', async () => {
      const an = makeChild({ id: 'k1', name: 'An' });
      const binh = makeChild({ id: 'k2', name: 'Bình' });
      const chi = makeChild({ id: 'k3', name: 'Chi' });
      children.find.mockResolvedValue([an, binh, chi]);
      attendance.findBy.mockResolvedValue([
        makeRecord({ id: 'r1', childId: 'k1', status: 'LATE', checkInTime: new Date(at(YESTERDAY, '08:20')), checkOutTime: new Date(at(YESTERDAY, '15:00')) }),
      ]);
      const leaveQb = createQueryBuilderMock([{ childId: 'k2' }]);
      leaves.createQueryBuilder.mockReturnValue(leaveQb);

      const { items } = await service.roster(CLASS_ID, { date: YESTERDAY }, TEACHER);

      expect(items).toEqual([
        { childId: 'k1', name: 'An', gender: 'MALE', attendanceId: 'r1', status: 'LATE', checkInTime: new Date(at(YESTERDAY, '08:20')).toISOString(), checkOutTime: new Date(at(YESTERDAY, '15:00')).toISOString(), earlyLeave: true, onLeave: false },
        { childId: 'k2', name: 'Bình', gender: 'MALE', attendanceId: null, status: 'ABSENT', checkInTime: null, checkOutTime: null, earlyLeave: false, onLeave: true },
        { childId: 'k3', name: 'Chi', gender: 'MALE', attendanceId: null, status: 'NOT_CHECKED_IN', checkInTime: null, checkOutTime: null, earlyLeave: false, onLeave: false },
      ]);
      // Chỉ đơn APPROVED phủ đúng ngày đang xem mới được tính
      expect(JSON.stringify(leaveQb.andWhere.mock.calls)).toContain("APPROVED");
      expect(leaveQb.andWhere).toHaveBeenCalledWith('leave.fromDate <= :date AND leave.toDate >= :date', { date: YESTERDAY });
    });
  });

  /* ---------------------------------------------------------------- check-in */
  describe('checkIn', () => {
    beforeEach(() => {
      children.findOne.mockResolvedValue(makeChild());
    });

    it.each(['PARENT', 'MEDICAL_STAFF', 'ADMIN'] as const)('UT-ATT-10 vai trò %s → 403 ROLE_NOT_ALLOWED, không mở transaction', async (role) => {
      expectHttpError(await getError(() => service.checkIn({ childId: CHILD_ID }, actor(role), IP)), ForbiddenException, 'ROLE_NOT_ALLOWED');
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('UT-ATT-11 hôm nay, không gửi giờ → dùng giờ hiện tại; 10:00 là LATE; lưu người thao tác', async () => {
      const res = await service.checkIn({ childId: CHILD_ID }, TEACHER, IP);
      expect(attendance.save).toHaveBeenCalledWith(
        expect.objectContaining({ childId: CHILD_ID, date: TODAY, status: 'LATE', checkInTime: NOW, checkOutTime: null, recordedByUserId: TEACHER.id }),
      );
      expect(res).toMatchObject({ id: RECORD_ID, date: TODAY, status: 'LATE', checkInTime: NOW.toISOString(), checkOutTime: null, recordedByUserId: TEACHER.id });
    });

    it.each([
      ['07:59', 'PRESENT'],
      ['08:00', 'PRESENT'],
      ['08:01', 'LATE'],
    ])('UT-ATT-12 ngày đã qua, đến lúc %s → %s', async (hhmm, status) => {
      await service.checkIn({ childId: CHILD_ID, date: YESTERDAY, checkInTime: at(YESTERDAY, hhmm) }, TEACHER, IP);
      expect(attendance.save).toHaveBeenCalledWith(expect.objectContaining({ date: YESTERDAY, status }));
    });

    it('UT-ATT-13 chỉ gửi giờ, không gửi ngày → ngày lấy theo giờ đó (giờ của trường)', async () => {
      await service.checkIn({ childId: CHILD_ID, checkInTime: at(YESTERDAY, '07:30') }, TEACHER, IP);
      expect(attendance.save).toHaveBeenCalledWith(expect.objectContaining({ date: YESTERDAY }));
    });

    it('UT-ATT-14 ghi vắng: status ABSENT, không có giờ đến; audit ghi MARK_ABSENT', async () => {
      await service.checkIn({ childId: CHILD_ID, date: YESTERDAY, status: 'ABSENT' }, TEACHER, IP);
      expect(attendance.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'ABSENT', checkInTime: null }));
      expect(auditLogs.record).toHaveBeenCalledWith(dataSource.manager, expect.objectContaining({ action: 'MARK_ABSENT' }));
    });

    it.each([
      ['ghi vắng kèm giờ đến', { status: 'ABSENT' as const, checkInTime: at(TODAY, '07:50') }],
      ['ngày tương lai', { date: TOMORROW }],
      ['ngày không có thật', { date: '2026-02-30' }],
      ['ngày đã qua nhưng thiếu giờ đến', { date: YESTERDAY }],
      ['giờ đến thuộc ngày khác với ngày điểm danh', { date: YESTERDAY, checkInTime: at(TODAY, '07:50') }],
      ['giờ đến ở tương lai (quá 1 phút)', { checkInTime: at(TODAY, '10:02') }],
      ['giờ đến không đọc được', { checkInTime: 'không phải giờ' }],
    ])('UT-ATT-15 %s → 400, không mở transaction', async (_label, patch) => {
      expectHttpError(await getError(() => service.checkIn({ childId: CHILD_ID, ...patch }, TEACHER, IP)), BadRequestException, 'VALIDATION_ERROR');
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('UT-ATT-15b giờ đến lệch tương lai dưới 1 phút (đồng hồ thiết bị) vẫn được nhận', async () => {
      await expect(service.checkIn({ childId: CHILD_ID, checkInTime: new Date(NOW.getTime() + 30_000).toISOString() }, TEACHER, IP)).resolves.toBeDefined();
    });

    it('UT-ATT-16 trẻ không tồn tại → 404; trẻ đã nghỉ học → 409 CHILD_NOT_ACTIVE; không lưu gì', async () => {
      children.findOne.mockResolvedValueOnce(null);
      expectHttpError(await getError(() => service.checkIn({ childId: CHILD_ID }, TEACHER, IP)), NotFoundException, 'CHILD_NOT_FOUND');
      children.findOne.mockResolvedValueOnce(makeChild({ status: 'WITHDRAWN' }));
      expectHttpError(await getError(() => service.checkIn({ childId: CHILD_ID }, TEACHER, IP)), ConflictException, 'CHILD_NOT_ACTIVE');
      expect(attendance.save).not.toHaveBeenCalled();
    });

    it('UT-ATT-17 giáo viên lớp khác → 403 CLASS_ACCESS_DENIED; quản lý điểm danh được mọi lớp', async () => {
      assignments.exist.mockResolvedValue(false);
      expectHttpError(await getError(() => service.checkIn({ childId: CHILD_ID }, TEACHER, IP)), ForbiddenException, 'CLASS_ACCESS_DENIED');
      expect(attendance.save).not.toHaveBeenCalled();
      await expect(service.checkIn({ childId: CHILD_ID }, MANAGER, IP)).resolves.toBeDefined();
    });

    it('UT-ATT-18 trẻ đã có bản ghi trong ngày → 409 ATTENDANCE_EXISTS, không lưu bản ghi thứ hai', async () => {
      attendance.exist.mockResolvedValue(true);
      expectHttpError(await getError(() => service.checkIn({ childId: CHILD_ID }, TEACHER, IP)), ConflictException, 'ATTENDANCE_EXISTS');
      expect(attendance.exist).toHaveBeenCalledWith({ where: { childId: CHILD_ID, date: TODAY } });
      expect(attendance.save).not.toHaveBeenCalled();
    });

    it('UT-ATT-19 hai giáo viên bấm cùng lúc: database báo unique violation (23505) → 409, không phải 500', async () => {
      dataSource.transaction.mockRejectedValueOnce({ driverError: { code: '23505' } });
      expectHttpError(await getError(() => service.checkIn({ childId: CHILD_ID }, TEACHER, IP)), ConflictException, 'ATTENDANCE_EXISTS');
    });

    it('UT-ATT-20 lỗi khác trong transaction (ví dụ ghi audit lỗi) → ném nguyên lỗi để rollback, không phát sự kiện', async () => {
      const failure = new Error('audit down');
      auditLogs.record.mockRejectedValue(failure);
      expect(await getError(() => service.checkIn({ childId: CHILD_ID }, TEACHER, IP))).toBe(failure);
      expect(events.publish).not.toHaveBeenCalled();
    });

    it('UT-ATT-21 thành công: audit ghi trong cùng transaction (người làm, hành động, IP); sự kiện phát sau khi lưu', async () => {
      await service.checkIn({ childId: CHILD_ID, date: YESTERDAY, checkInTime: at(YESTERDAY, '07:45') }, TEACHER, IP);
      expect(auditLogs.record).toHaveBeenCalledWith(
        dataSource.manager,
        expect.objectContaining({
          actorUserId: TEACHER.id,
          actorName: TEACHER.fullName,
          action: 'CHECK_IN',
          resourceType: 'attendance',
          resourceId: RECORD_ID,
          oldValue: null,
          newValue: { childId: CHILD_ID, date: YESTERDAY, status: 'PRESENT', checkInTime: new Date(at(YESTERDAY, '07:45')).toISOString() },
          ipAddress: IP,
        }),
      );
      expect(events.publish).toHaveBeenCalledWith('attendance.recorded', {
        attendanceId: RECORD_ID,
        childId: CHILD_ID,
        classId: CLASS_ID,
        date: YESTERDAY,
        action: 'CHECK_IN',
        status: 'PRESENT',
        actorUserId: TEACHER.id,
      });
    });
  });

  /* --------------------------------------------------------------- check-out */
  describe('checkOut', () => {
    beforeEach(() => {
      children.findOneBy.mockResolvedValue(makeChild());
      attendance.findOne.mockResolvedValue(makeRecord());
    });

    it('UT-ATT-30 check-out hợp lệ lúc 10:00 hôm nay: lưu giờ về và người cho về; về trước 16:00 → earlyLeave', async () => {
      const res = await service.checkOut({ childId: CHILD_ID }, TEACHER, IP);
      expect(attendance.save).toHaveBeenCalledWith(expect.objectContaining({ checkOutTime: NOW, checkedOutByUserId: TEACHER.id }));
      expect(res).toMatchObject({ checkOutTime: NOW.toISOString(), earlyLeave: true, status: 'PRESENT' });
      expect(auditLogs.record).toHaveBeenCalledWith(
        dataSource.manager,
        expect.objectContaining({ action: 'CHECK_OUT', oldValue: { checkOutTime: null }, newValue: { checkOutTime: NOW.toISOString() } }),
      );
      expect(events.publish).toHaveBeenCalledWith('attendance.recorded', expect.objectContaining({ action: 'CHECK_OUT' }));
    });

    it('UT-ATT-31 về đúng hoặc sau 16:00 → không phải về sớm', async () => {
      attendance.findOne.mockResolvedValue(makeRecord({ date: YESTERDAY, checkInTime: new Date(at(YESTERDAY, '07:50')) }));
      const res = await service.checkOut({ childId: CHILD_ID, date: YESTERDAY, checkOutTime: at(YESTERDAY, '16:00') }, TEACHER, IP);
      expect(res.earlyLeave).toBe(false);
    });

    it('UT-ATT-32 khóa dòng điểm danh khi check-out để hai lần check-out đồng thời chạy tuần tự', async () => {
      await service.checkOut({ childId: CHILD_ID }, TEACHER, IP);
      expect(attendance.findOne).toHaveBeenCalledWith({ where: { childId: CHILD_ID, date: TODAY }, lock: { mode: 'pessimistic_write' } });
    });

    it.each([
      ['chưa có bản ghi', null, 'NOT_CHECKED_IN'],
      ['bản ghi vắng', makeRecord({ status: 'ABSENT', checkInTime: null }), 'NOT_CHECKED_IN'],
      ['đã check-out rồi', makeRecord({ checkOutTime: new Date(at(TODAY, '09:00')) }), 'ALREADY_CHECKED_OUT'],
    ])('UT-ATT-33 %s → 409 %s, không lưu', async (_label, record, code) => {
      attendance.findOne.mockResolvedValue(record);
      expectHttpError(await getError(() => service.checkOut({ childId: CHILD_ID }, TEACHER, IP)), ConflictException, code);
      expect(attendance.save).not.toHaveBeenCalled();
    });

    it('UT-ATT-34 giờ về trước giờ đến → 400', async () => {
      attendance.findOne.mockResolvedValue(makeRecord({ checkInTime: new Date(at(TODAY, '09:30')) }));
      expectHttpError(await getError(() => service.checkOut({ childId: CHILD_ID, checkOutTime: at(TODAY, '09:00') }, TEACHER, IP)), BadRequestException, 'VALIDATION_ERROR');
    });

    it.each([
      ['ngày tương lai', { date: TOMORROW }],
      ['ngày đã qua nhưng thiếu giờ về', { date: YESTERDAY }],
      ['giờ về ở tương lai', { checkOutTime: at(TODAY, '15:00') }],
      ['giờ về thuộc ngày khác', { date: YESTERDAY, checkOutTime: at(TODAY, '09:00') }],
    ])('UT-ATT-35 %s → 400, không mở transaction', async (_label, patch) => {
      expectHttpError(await getError(() => service.checkOut({ childId: CHILD_ID, ...patch }, TEACHER, IP)), BadRequestException, 'VALIDATION_ERROR');
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('UT-ATT-36 giáo viên lớp khác → 403; trẻ không tồn tại → 404; vai trò phụ huynh → 403', async () => {
      assignments.exist.mockResolvedValueOnce(false);
      expectHttpError(await getError(() => service.checkOut({ childId: CHILD_ID }, TEACHER, IP)), ForbiddenException, 'CLASS_ACCESS_DENIED');
      children.findOneBy.mockResolvedValueOnce(null);
      expectHttpError(await getError(() => service.checkOut({ childId: CHILD_ID }, TEACHER, IP)), NotFoundException, 'CHILD_NOT_FOUND');
      expectHttpError(await getError(() => service.checkOut({ childId: CHILD_ID }, PARENT, IP)), ForbiddenException, 'ROLE_NOT_ALLOWED');
      expect(attendance.save).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------ update */
  describe('update (sửa điểm danh)', () => {
    beforeEach(() => {
      children.findOneBy.mockResolvedValue(makeChild());
      attendance.findOne.mockResolvedValue(makeRecord());
    });

    it('UT-ATT-40 body rỗng → 400 EMPTY_UPDATE trước khi truy vấn database', async () => {
      expectHttpError(await getError(() => service.update(RECORD_ID, {}, TEACHER, IP)), BadRequestException, 'EMPTY_UPDATE');
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('UT-ATT-41 bản ghi không tồn tại → 404 ATTENDANCE_NOT_FOUND', async () => {
      attendance.findOne.mockResolvedValue(null);
      expectHttpError(await getError(() => service.update(RECORD_ID, { status: 'ABSENT' }, TEACHER, IP)), NotFoundException, 'ATTENDANCE_NOT_FOUND');
    });

    it('UT-ATT-42 đổi giờ đến sang 08:20 → server tự tính lại thành LATE; audit ghi giá trị trước/sau', async () => {
      const res = await service.update(RECORD_ID, { checkInTime: at(TODAY, '08:20') }, TEACHER, IP);
      expect(res.status).toBe('LATE');
      expect(auditLogs.record).toHaveBeenCalledWith(
        dataSource.manager,
        expect.objectContaining({
          action: 'UPDATE_ATTENDANCE',
          oldValue: { status: 'PRESENT', checkInTime: new Date(at(TODAY, '07:50')).toISOString(), checkOutTime: null },
          newValue: { status: 'LATE', checkInTime: new Date(at(TODAY, '08:20')).toISOString(), checkOutTime: null },
        }),
      );
      expect(events.publish).toHaveBeenCalledWith('attendance.recorded', expect.objectContaining({ action: 'UPDATE', status: 'LATE' }));
    });

    it('UT-ATT-43 người dùng chọn PRESENT nhưng giờ đến 08:30 → vẫn là LATE (trạng thái có mặt/muộn do server tính)', async () => {
      const res = await service.update(RECORD_ID, { status: 'PRESENT', checkInTime: at(TODAY, '08:30') }, TEACHER, IP);
      expect(res.status).toBe('LATE');
    });

    it('UT-ATT-44 người dùng chọn EARLY_LEAVE → giữ nguyên lựa chọn', async () => {
      const res = await service.update(RECORD_ID, { status: 'EARLY_LEAVE', checkOutTime: at(TODAY, '09:30') }, TEACHER, IP);
      expect(res).toMatchObject({ status: 'EARLY_LEAVE', checkOutTime: new Date(at(TODAY, '09:30')).toISOString() });
    });

    it('UT-ATT-45 chuyển sang ABSENT → xóa giờ đến và giờ về', async () => {
      attendance.findOne.mockResolvedValue(makeRecord({ checkOutTime: new Date(at(TODAY, '09:00')) }));
      const res = await service.update(RECORD_ID, { status: 'ABSENT' }, TEACHER, IP);
      expect(res).toMatchObject({ status: 'ABSENT', checkInTime: null, checkOutTime: null });
    });

    it('UT-ATT-46 ABSENT kèm giờ → 400; bản ghi không bị lưu', async () => {
      expectHttpError(await getError(() => service.update(RECORD_ID, { status: 'ABSENT', checkInTime: at(TODAY, '07:50') }, TEACHER, IP)), BadRequestException, 'VALIDATION_ERROR');
      expect(attendance.save).not.toHaveBeenCalled();
    });

    it('UT-ATT-47 từ vắng về có mặt mà không gửi giờ đến → 400; có giờ đến → được, trạng thái tính theo giờ', async () => {
      attendance.findOne.mockResolvedValue(makeRecord({ status: 'ABSENT', checkInTime: null }));
      expectHttpError(await getError(() => service.update(RECORD_ID, { status: 'PRESENT' }, TEACHER, IP)), BadRequestException, 'VALIDATION_ERROR');
      const res = await service.update(RECORD_ID, { status: 'PRESENT', checkInTime: at(TODAY, '07:40') }, TEACHER, IP);
      expect(res).toMatchObject({ status: 'PRESENT', checkInTime: new Date(at(TODAY, '07:40')).toISOString() });
    });

    it.each([
      ['giờ về trước giờ đến', { checkOutTime: at(TODAY, '07:00') }],
      ['giờ đến thuộc ngày khác', { checkInTime: at(YESTERDAY, '07:50') }],
      ['giờ về thuộc ngày khác', { checkOutTime: at(YESTERDAY, '15:00') }],
      ['giờ đến ở tương lai', { checkInTime: at(TODAY, '11:00') }],
      ['giờ về ở tương lai', { checkOutTime: at(TODAY, '15:00') }],
      ['xóa giờ đến của bản ghi có mặt', { checkInTime: null }],
    ])('UT-ATT-48 %s → 400, không lưu', async (_label, patch) => {
      expectHttpError(await getError(() => service.update(RECORD_ID, patch, TEACHER, IP)), BadRequestException, 'VALIDATION_ERROR');
      expect(attendance.save).not.toHaveBeenCalled();
    });

    it('UT-ATT-49 xóa giờ về bằng null → được', async () => {
      attendance.findOne.mockResolvedValue(makeRecord({ checkOutTime: new Date(at(TODAY, '09:00')) }));
      const res = await service.update(RECORD_ID, { checkOutTime: null }, TEACHER, IP);
      expect(res.checkOutTime).toBeNull();
    });

    it('UT-ATT-50 gửi đúng giá trị đang có → không ghi audit, không phát sự kiện', async () => {
      await service.update(RECORD_ID, { checkInTime: at(TODAY, '07:50') }, TEACHER, IP);
      expect(auditLogs.record).not.toHaveBeenCalled();
      expect(events.publish).not.toHaveBeenCalled();
    });

    it('UT-ATT-51 giáo viên lớp khác → 403; phụ huynh → 403; khóa dòng khi sửa', async () => {
      assignments.exist.mockResolvedValueOnce(false);
      expectHttpError(await getError(() => service.update(RECORD_ID, { status: 'ABSENT' }, TEACHER, IP)), ForbiddenException, 'CLASS_ACCESS_DENIED');
      expect(attendance.findOne).toHaveBeenCalledWith({ where: { id: RECORD_ID }, lock: { mode: 'pessimistic_write' } });
      expectHttpError(await getError(() => service.update(RECORD_ID, { status: 'ABSENT' }, PARENT, IP)), ForbiddenException, 'ROLE_NOT_ALLOWED');
      expect(attendance.save).not.toHaveBeenCalled();
    });

    // Hành vi hiện tại, cần nhóm chốt (README vấn đề #23): bản ghi EARLY_LEAVE, giáo viên chỉ sửa giờ về
    // (không gửi status) thì trạng thái bị tính lại thành PRESENT/LATE, mất EARLY_LEAVE.
    it('UT-ATT-52 bản ghi EARLY_LEAVE chỉ sửa giờ về → trạng thái bị tính lại thành PRESENT (hành vi hiện tại)', async () => {
      attendance.findOne.mockResolvedValue(makeRecord({ status: 'EARLY_LEAVE', checkOutTime: new Date(at(TODAY, '09:00')) }));
      const res = await service.update(RECORD_ID, { checkOutTime: at(TODAY, '09:15') }, TEACHER, IP);
      expect(res.status).toBe('PRESENT');
    });
  });

  /* ------------------------------------------------------------ UC-07 today */
  describe('today (UC-07 trạng thái hôm nay)', () => {
    const leaveQb = (exists: boolean) => {
      const qb = createQueryBuilderMock(exists ? [{}] : []);
      leaves.createQueryBuilder.mockReturnValue(qb);
      return qb;
    };

    beforeEach(() => {
      children.findOneBy.mockResolvedValue(makeChild());
      links.exist.mockResolvedValue(true); // PARENT đã liên kết với trẻ
      leaveQb(false);
    });

    it('UT-ATT-60 phụ huynh đã liên kết; chưa điểm danh → NOT_CHECKED_IN, các giờ là null', async () => {
      await expect(service.today(CHILD_ID, PARENT)).resolves.toEqual({
        childId: CHILD_ID, date: TODAY, status: 'NOT_CHECKED_IN', checkInTime: null, checkOutTime: null, earlyLeave: false, onLeave: false,
      });
    });

    it('UT-ATT-61 có đơn nghỉ đã duyệt hôm nay và chưa có bản ghi → ABSENT, onLeave', async () => {
      leaveQb(true);
      await expect(service.today(CHILD_ID, PARENT)).resolves.toMatchObject({ status: 'ABSENT', onLeave: true });
    });

    it('UT-ATT-62 có bản ghi → trả trạng thái và giờ của bản ghi, không lộ id người điểm danh', async () => {
      attendance.findOneBy.mockResolvedValue(makeRecord());
      const res = await service.today(CHILD_ID, PARENT);
      expect(res).toMatchObject({ status: 'PRESENT', checkInTime: new Date(at(TODAY, '07:50')).toISOString() });
      expect(res).not.toHaveProperty('recordedByUserId');
      expect(attendance.findOneBy).toHaveBeenCalledWith({ childId: CHILD_ID, date: TODAY });
    });

    it('UT-ATT-63 IDOR: phụ huynh chưa liên kết đổi id trên URL → 403, không đọc điểm danh', async () => {
      links.exist.mockResolvedValue(false);
      expectHttpError(await getError(() => service.today(CHILD_ID, PARENT)), ForbiddenException, 'CHILD_ACCESS_DENIED');
      expect(attendance.findOneBy).not.toHaveBeenCalled();
    });

    it('UT-ATT-64 trẻ không tồn tại → 404; y tế → 403', async () => {
      children.findOneBy.mockResolvedValueOnce(null);
      expectHttpError(await getError(() => service.today(CHILD_ID, PARENT)), NotFoundException, 'CHILD_NOT_FOUND');
      expectHttpError(await getError(() => service.today(CHILD_ID, actor('MEDICAL_STAFF'))), ForbiddenException, 'CHILD_ACCESS_DENIED');
    });
  });

  /* ---------------------------------------------------------- UC-07 history */
  describe('history (UC-07 lịch sử)', () => {
    let qb: ReturnType<typeof createQueryBuilderMock>;

    beforeEach(() => {
      children.findOneBy.mockResolvedValue(makeChild());
      links.exist.mockResolvedValue(true);
      qb = createQueryBuilderMock([makeRecord({ date: YESTERDAY })], 45);
      attendance.createQueryBuilder.mockReturnValue(qb);
    });

    it('UT-ATT-70 phân trang: bỏ qua (page-1)*limit, mới nhất trước, tổng số trang làm tròn lên', async () => {
      const res = await service.history(CHILD_ID, { page: 3, limit: 20 }, PARENT);
      expect(qb.skip).toHaveBeenCalledWith(40);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(qb.orderBy).toHaveBeenCalledWith('attendance.date', 'DESC');
      expect(res.pageInfo).toEqual({ page: 3, limit: 20, totalItems: 45, totalPages: 3 });
      expect(res.items[0]).toMatchObject({ id: RECORD_ID, date: YESTERDAY });
    });

    it('UT-ATT-71 lọc theo khoảng ngày from/to', async () => {
      await service.history(CHILD_ID, { from: '2026-11-01', to: '2026-11-08', page: 1, limit: 20 }, PARENT);
      expect(qb.andWhere).toHaveBeenCalledWith('attendance.date >= :from', { from: '2026-11-01' });
      expect(qb.andWhere).toHaveBeenCalledWith('attendance.date <= :to', { to: '2026-11-08' });
    });

    it.each([
      ['khoảng ngày đảo ngược', { from: '2026-11-08', to: '2026-11-01' }],
      ['ngày bắt đầu không có thật', { from: '2026-02-30' }],
      ['ngày kết thúc không có thật', { to: '2026-13-01' }],
    ])('UT-ATT-72 %s → 400', async (_label, range) => {
      expectHttpError(await getError(() => service.history(CHILD_ID, { ...range, page: 1, limit: 20 }, PARENT)), BadRequestException, 'VALIDATION_ERROR');
    });

    it('UT-ATT-73 IDOR: phụ huynh chưa liên kết → 403, không truy vấn lịch sử', async () => {
      links.exist.mockResolvedValue(false);
      expectHttpError(await getError(() => service.history(CHILD_ID, { page: 1, limit: 20 }, PARENT)), ForbiddenException, 'CHILD_ACCESS_DENIED');
      expect(attendance.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
