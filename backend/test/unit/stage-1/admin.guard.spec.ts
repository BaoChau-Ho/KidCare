import { ForbiddenException } from '@nestjs/common';
import {
  createHttpContext,
  expectHttpError,
  getError,
} from '../../helpers/mocks';
import { AdminGuard } from '../../../src/auth/admin.guard';

// Giai đoạn 1 — AdminGuard: chỉ admin được gọi API quản trị.
// Danh sách test và tiến độ: backend/test/README.md.

describe('GĐ1 · AdminGuard', () => {
  const guard = new AdminGuard();
  const runAs = (role: string) => () =>
    guard.canActivate(createHttpContext({ user: { role } }));

  it('UT-ADMIN-01 admin được cho qua', () => {
    expect(runAs('ADMIN')()).toBe(true);
  });

  it.each(['PARENT', 'TEACHER', 'MEDICAL_STAFF', 'MANAGER'])(
    'UT-ADMIN-02 vai trò %s → 403 ADMIN_ONLY',
    async (role) => {
      expectHttpError(
        await getError(runAs(role)),
        ForbiddenException,
        'ADMIN_ONLY',
      );
    },
  );

  // Hiện guard ném TypeError (thành lỗi 500) khi thiếu request.user.
  // Test này chỉ khẳng định không cho qua; xem phát hiện số 4 trong tài liệu thiết kế.
  it('UT-ADMIN-03 chưa qua JwtAuthGuard (không có request.user) → không cho qua', () => {
    expect(() => guard.canActivate(createHttpContext({}))).toThrow();
  });
});
