import { isExclusionViolation, isUniqueViolation } from '../../../src/common/db-errors';

// Giai đoạn 3 — đổi lỗi ràng buộc của PostgreSQL thành lỗi nghiệp vụ 409 thay vì 500
// (điểm danh trùng ngày: UNIQUE 23505; đơn nghỉ giao nhau: EXCLUDE 23P01).

describe('GĐ3 · db-errors', () => {
  it('UT-DBERR-01 nhận mã lỗi ở cả lỗi của driver pg và QueryFailedError của TypeORM (driverError)', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ driverError: { code: '23505' } })).toBe(true);
    expect(isExclusionViolation({ code: '23P01' })).toBe(true);
    expect(isExclusionViolation({ driverError: { code: '23P01' } })).toBe(true);
  });

  it('UT-DBERR-02 không nhầm giữa hai loại lỗi và với lỗi ràng buộc khác (23503 khóa ngoại)', () => {
    expect(isUniqueViolation({ code: '23P01' })).toBe(false);
    expect(isExclusionViolation({ code: '23505' })).toBe(false);
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
  });

  it.each([null, undefined, 'lỗi', 42, new Error('x'), { code: 23505 }, { driverError: null }])(
    'UT-DBERR-03 giá trị không phải lỗi PostgreSQL %p → false, không ném lỗi',
    (value) => {
      expect(isUniqueViolation(value)).toBe(false);
      expect(isExclusionViolation(value)).toBe(false);
    },
  );
});
