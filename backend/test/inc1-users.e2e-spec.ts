// Increment 1 — quản lý người dùng (UC-03).
// Mã test case: docs/03-testing/Test_Cases.md. API: docs/02-design/openapi.yaml.
// Đang ở dạng it.todo vì module users chưa có API. Khi API được merge vào main,
// thay it.todo bằng it(...) và dùng createTestApp() trong ./helpers/app.

describe('Inc 1 — Quản lý người dùng (e2e)', () => {
  it.todo('TC-USER-01 admin tạo tài khoản → 201');
  it.todo('TC-USER-02 admin tạo tài khoản email trùng → 409');
  it.todo('TC-USER-03 admin đổi vai trò → 200, có audit log giá trị cũ và mới');
  it.todo('TC-USER-04 admin khóa tài khoản → tài khoản đó không đăng nhập được');
  it.todo('TC-USER-05 admin không khóa được chính mình');
  it.todo('TC-USER-06 GET /users có phân trang');
  it.todo('TC-USER-07 người dùng xem, sửa /users/me nhưng không tự đổi được vai trò');
});
