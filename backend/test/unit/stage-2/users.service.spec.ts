// Giai đoạn 2 — UC-03 quản lý tài khoản (Admin).
// Danh sách test và tiến độ: backend/test/README.md.
// Chưa có UsersService nên đang ở dạng it.todo. Khi có code, thay bằng it(...).

describe('GĐ2 · UsersService', () => {
  it.todo(
    'UT-USER-01 tạo tài khoản hợp lệ: email chuẩn hóa, mật khẩu tạm được hash, không trả hash',
  );
  it.todo('UT-USER-02 tạo tài khoản email trùng → 409, không lưu');
  it.todo(
    'UT-USER-03 danh sách có phân trang: limit mặc định, limit vượt mức tối đa bị giới hạn',
  );
  it.todo('UT-USER-04 lọc theo role, status, từ khóa');
  it.todo('UT-USER-05 sửa thông tin chỉ cập nhật các trường cho phép');
  it.todo('UT-USER-06 đổi role hợp lệ → lưu và ghi audit log giá trị cũ / mới');
  it.todo('UT-USER-07 đổi sang role không hợp lệ → 400');
  it.todo('UT-USER-08 khóa tài khoản → đổi trạng thái và ghi audit log');
  it.todo('UT-USER-09 admin tự khóa chính mình → bị từ chối');
  it.todo('UT-USER-10 thao tác trên tài khoản không tồn tại → 404');
  it.todo('UT-USER-11 audit log không chứa mật khẩu, hash, token');
});
