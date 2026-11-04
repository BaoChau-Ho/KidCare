// Giai đoạn 1–2 — RolesGuard (roadmap Stage 1, Bước 4). Hiện mới có AdminGuard.
// Danh sách test và tiến độ: backend/test/README.md.
// Chưa có RolesGuard nên đang ở dạng it.todo. Khi có code, thay bằng it(...).

describe('GĐ1 · RolesGuard', () => {
  it.todo('UT-ROLES-01 role nằm trong danh sách cho phép → cho qua');
  it.todo('UT-ROLES-02 role không nằm trong danh sách → 403');
  it.todo('UT-ROLES-03 route không khai báo role → mặc định từ chối');
  it.todo('UT-ROLES-04 route khai báo công khai → cho qua khi chưa đăng nhập');
});
