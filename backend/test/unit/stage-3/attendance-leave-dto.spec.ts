// DTO dùng decorator có metadata kiểu; file này không import @nestjs/common nên phải tự nạp reflect-metadata.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { invalidFields } from '../../helpers/mocks';
import { AttendanceHistoryQueryDto } from '../../../src/attendance/dto/attendance-history-query.dto';
import { CheckInDto } from '../../../src/attendance/dto/check-in.dto';
import { CheckOutDto } from '../../../src/attendance/dto/check-out.dto';
import { RosterQueryDto } from '../../../src/attendance/dto/roster-query.dto';
import { UpdateAttendanceDto } from '../../../src/attendance/dto/update-attendance.dto';
import { CreateLeaveRequestDto } from '../../../src/leave-requests/dto/create-leave-request.dto';
import { ListLeaveRequestsQueryDto } from '../../../src/leave-requests/dto/list-leave-requests-query.dto';
import { RejectLeaveRequestDto } from '../../../src/leave-requests/dto/reject-leave-request.dto';

// Giai đoạn 3 — kiểm tra dữ liệu vào của API điểm danh (UC-06, UC-07) và đơn nghỉ (UC-08), chạy như ValidationPipe.
// Các quy tắc cần dữ liệu khác (ngày tương lai, ngày không có thật, khoảng ngày) nằm ở service, xem attendance.service.spec.ts.

const CHILD_ID = '3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b'; // UUID v4

describe('GĐ3 · DTO điểm danh', () => {
  describe('CheckInDto', () => {
    it.each([
      ['chỉ có childId (hôm nay, giờ hiện tại)', { childId: CHILD_ID }],
      ['kèm ngày và giờ có múi giờ', { childId: CHILD_ID, date: '2026-11-09', checkInTime: '2026-11-09T07:55:00+07:00' }],
      ['ghi vắng', { childId: CHILD_ID, date: '2026-11-09', status: 'ABSENT' }],
    ])('UT-DTO-ATT-01 hợp lệ: %s', async (_label, input) => {
      expect(await invalidFields(CheckInDto, input)).toEqual([]);
    });

    it.each([
      ['thiếu childId', {}, 'childId'],
      ['childId không phải UUID', { childId: '123' }, 'childId'],
      ['childId là UUID v1', { childId: 'a8098c1a-f86e-11da-bd1a-00112444be1e' }, 'childId'],
      ['ngày sai định dạng', { childId: CHILD_ID, date: '09/11/2026' }, 'date'],
      ['giờ không phải ISO 8601', { childId: CHILD_ID, checkInTime: '07:55' }, 'checkInTime'],
      ['giờ có ngày không có thật', { childId: CHILD_ID, checkInTime: '2026-02-30T07:55:00+07:00' }, 'checkInTime'],
      ['status khác ABSENT', { childId: CHILD_ID, status: 'PRESENT' }, 'status'],
      ['status chữ thường', { childId: CHILD_ID, status: 'absent' }, 'status'],
    ])('UT-DTO-ATT-02 bị từ chối: %s', async (_label, input, field) => {
      expect(await invalidFields(CheckInDto, input)).toEqual([field]);
    });
  });

  describe('CheckOutDto', () => {
    it('UT-DTO-ATT-03 hợp lệ khi chỉ có childId, hoặc kèm ngày và giờ', async () => {
      expect(await invalidFields(CheckOutDto, { childId: CHILD_ID })).toEqual([]);
      expect(await invalidFields(CheckOutDto, { childId: CHILD_ID, date: '2026-11-09', checkOutTime: '2026-11-09T16:05:00+07:00' })).toEqual([]);
    });

    it.each([
      ['thiếu childId', {}, 'childId'],
      ['ngày sai định dạng', { childId: CHILD_ID, date: '2026-11-9' }, 'date'],
      ['giờ không phải ISO 8601', { childId: CHILD_ID, checkOutTime: 'chiều nay' }, 'checkOutTime'],
    ])('UT-DTO-ATT-04 bị từ chối: %s', async (_label, input, field) => {
      expect(await invalidFields(CheckOutDto, input)).toEqual([field]);
    });
  });

  describe('UpdateAttendanceDto', () => {
    it.each(['PRESENT', 'ABSENT', 'LATE', 'EARLY_LEAVE'])('UT-DTO-ATT-05 status %s hợp lệ', async (status) => {
      expect(await invalidFields(UpdateAttendanceDto, { status })).toEqual([]);
    });

    it('UT-DTO-ATT-06 NOT_CHECKED_IN chỉ là trạng thái hiển thị, không được ghi vào bản ghi', async () => {
      expect(await invalidFields(UpdateAttendanceDto, { status: 'NOT_CHECKED_IN' })).toEqual(['status']);
    });

    it('UT-DTO-ATT-07 giờ = null nghĩa là xóa giờ và hợp lệ; giờ sai định dạng bị từ chối', async () => {
      expect(await invalidFields(UpdateAttendanceDto, { checkOutTime: null })).toEqual([]);
      expect(await invalidFields(UpdateAttendanceDto, { checkInTime: '8h' })).toEqual(['checkInTime']);
    });
  });

  describe('RosterQueryDto', () => {
    it('UT-DTO-ATT-08 ngày không bắt buộc; có thì phải đúng YYYY-MM-DD', async () => {
      expect(await invalidFields(RosterQueryDto, {})).toEqual([]);
      expect(await invalidFields(RosterQueryDto, { date: '2026-11-09' })).toEqual([]);
      expect(await invalidFields(RosterQueryDto, { date: 'hôm nay' })).toEqual(['date']);
    });
  });

  describe('AttendanceHistoryQueryDto', () => {
    it('UT-DTO-ATT-09 mặc định page = 1, limit = 20; chuỗi số trên query được đổi sang số', async () => {
      const defaults = plainToInstance(AttendanceHistoryQueryDto, {});
      expect({ page: defaults.page, limit: defaults.limit }).toEqual({ page: 1, limit: 20 });
      const parsed = plainToInstance(AttendanceHistoryQueryDto, { page: '3', limit: '50' });
      expect({ page: parsed.page, limit: parsed.limit }).toEqual({ page: 3, limit: 50 });
    });

    it.each([
      [{ limit: '100' }, []],
      [{ limit: '101' }, ['limit']],
      [{ limit: '0' }, ['limit']],
      [{ page: '0' }, ['page']],
      [{ page: '1.5' }, ['page']],
      [{ from: '2026-1-1' }, ['from']],
      [{ to: 'abc' }, ['to']],
    ])('UT-DTO-ATT-10 biên phân trang và định dạng ngày: %j → lỗi ở %j', async (input, fields) => {
      expect(await invalidFields(AttendanceHistoryQueryDto, input)).toEqual(fields);
    });
  });
});

describe('GĐ3 · DTO đơn nghỉ', () => {
  const valid = { childId: CHILD_ID, fromDate: '2026-11-10', toDate: '2026-11-11', reason: 'Bé bị sốt' };

  describe('CreateLeaveRequestDto', () => {
    it('UT-DTO-LEAVE-01 đơn hợp lệ; lý do được trim', async () => {
      expect(await invalidFields(CreateLeaveRequestDto, valid)).toEqual([]);
      expect(plainToInstance(CreateLeaveRequestDto, { ...valid, reason: '  Bé bị sốt  ' }).reason).toBe('Bé bị sốt');
    });

    it.each([
      ['thiếu childId', { childId: undefined }, 'childId'],
      ['thiếu ngày bắt đầu', { fromDate: undefined }, 'fromDate'],
      ['ngày kết thúc sai định dạng', { toDate: '11/11/2026' }, 'toDate'],
      ['thiếu lý do', { reason: undefined }, 'reason'],
      ['lý do rỗng', { reason: '' }, 'reason'],
      ['lý do toàn dấu cách', { reason: '   ' }, 'reason'],
      ['lý do không phải chuỗi', { reason: 123 }, 'reason'],
    ])('UT-DTO-LEAVE-02 bị từ chối: %s', async (_label, patch, field) => {
      expect(await invalidFields(CreateLeaveRequestDto, { ...valid, ...patch })).toEqual([field]);
    });

    it('UT-DTO-LEAVE-03 lý do tối đa 1000 ký tự (khớp maxLength trong OpenAPI)', async () => {
      expect(await invalidFields(CreateLeaveRequestDto, { ...valid, reason: 'a'.repeat(1000) })).toEqual([]);
      expect(await invalidFields(CreateLeaveRequestDto, { ...valid, reason: 'a'.repeat(1001) })).toEqual(['reason']);
    });
  });

  describe('RejectLeaveRequestDto', () => {
    it('UT-DTO-LEAVE-04 từ chối bắt buộc có lý do 1-500 ký tự sau khi trim', async () => {
      expect(await invalidFields(RejectLeaveRequestDto, { reason: 'Trùng lịch' })).toEqual([]);
      expect(await invalidFields(RejectLeaveRequestDto, {})).toEqual(['reason']);
      expect(await invalidFields(RejectLeaveRequestDto, { reason: '   ' })).toEqual(['reason']);
      expect(await invalidFields(RejectLeaveRequestDto, { reason: 'a'.repeat(500) })).toEqual([]);
      expect(await invalidFields(RejectLeaveRequestDto, { reason: 'a'.repeat(501) })).toEqual(['reason']);
    });
  });

  describe('ListLeaveRequestsQueryDto', () => {
    it.each([
      [{}, []],
      [{ status: 'PENDING', childId: CHILD_ID, classId: CHILD_ID, page: '2', limit: '10' }, []],
      [{ status: 'pending' }, ['status']],
      [{ status: 'DONE' }, ['status']],
      [{ childId: 'abc' }, ['childId']],
      [{ classId: 'abc' }, ['classId']],
      [{ limit: '101' }, ['limit']],
      [{ page: '0' }, ['page']],
    ])('UT-DTO-LEAVE-05 bộ lọc %j → lỗi ở %j', async (input, fields) => {
      expect(await invalidFields(ListLeaveRequestsQueryDto, input)).toEqual(fields);
    });
  });
});
