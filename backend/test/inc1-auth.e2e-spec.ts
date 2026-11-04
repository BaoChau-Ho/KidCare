// Increment 1 — xác thực (UC-01, UC-02) và bảo mật nền tảng.
// Mã test case: docs/03-testing/Test_Cases.md. API: docs/02-design/openapi.yaml.
// Đang ở dạng it.todo vì module auth chưa được code. Khi API được merge vào main,
// thay it.todo bằng it(...) và dùng createTestApp() trong ./helpers/app.

describe('Inc 1 — Xác thực (e2e)', () => {
  describe('Đăng ký — POST /auth/register', () => {
    it.todo('TC-AUTH-01 đăng ký phụ huynh hợp lệ → 201, vai trò PARENT');
    it.todo('TC-AUTH-02 đăng ký email đã tồn tại → 409');
    it.todo('TC-AUTH-03 đăng ký thiếu trường hoặc mật khẩu yếu → 400');
  });

  describe('Đăng nhập, đăng xuất, token — /auth/login, /auth/logout, /auth/refresh', () => {
    it.todo('TC-AUTH-04 đăng nhập đúng → 200, có access token và vai trò');
    it.todo('TC-AUTH-05 sai email hoặc mật khẩu → 401, thông báo giống nhau cho cả hai trường hợp');
    it.todo('TC-AUTH-06 tài khoản bị khóa đăng nhập → 403');
    it.todo('TC-AUTH-07 đăng xuất xong, refresh token cũ bị từ chối → 401');
    it.todo('TC-AUTH-08 refresh token hợp lệ → access token mới');
    it.todo('TC-AUTH-09 đổi mật khẩu với mật khẩu hiện tại sai → bị từ chối');
  });

  describe('Phân quyền', () => {
    it.todo('TC-AUTH-10 gọi API cần đăng nhập mà không có token → 401');
    it.todo('TC-AUTH-11 phụ huynh gọi GET /users → 403');
  });

  describe('Bảo mật', () => {
    it.todo('TC-SEC-02 mật khẩu lưu dạng hash trong bảng users');
    it.todo('TC-SEC-03 access token hết hạn → 401');
    it.todo('TC-SEC-04 access token bị sửa chữ ký → 401');
    it.todo('TC-SEC-05 đăng nhập sai lần thứ 6 trong 1 phút → 429');
    it.todo(
      'TC-SEC-06 dữ liệu lạ vào API auth (quá dài, sai kiểu, ký tự đặc biệt) → 400, không 500',
    );
    it.todo('TC-SEC-07 response người dùng không chứa passwordHash');
    it.todo('TC-SEC-08 quét mọi route: không có token → 401, trừ danh sách route công khai');
  });
});
