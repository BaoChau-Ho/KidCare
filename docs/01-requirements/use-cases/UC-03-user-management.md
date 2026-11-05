# UC-03 — Quản lý tài khoản người dùng

| Thuộc tính | Nội dung |
|---|---|
| Mã | UC-03 |
| Tác nhân chính | Admin |
| Mức quan trọng | Cao |
| Loại | Chi tiết, thiết yếu |
| Yêu cầu liên quan | FR-USER-01, FR-USER-02, FR-AUTH-04 |
| Trạng thái tài liệu | Chuyển từ `04_Dac_Ta_Use_Case.md`; chưa đồng nghĩa tính năng đã được code |

## Mục tiêu

Admin tạo và quản lý tài khoản tập trung, gán đúng vai trò và kiểm soát trạng thái truy cập. Các thay đổi quản trị được ghi vào audit log.

## Các bên liên quan

- **Admin:** cần quản lý tài khoản và vai trò.
- **Nhà trường:** chỉ người có quyền mới truy cập được dữ liệu phù hợp.
- **Người dùng:** được cấp đúng vai trò và trạng thái tài khoản.

## Tiền điều kiện

- Admin đã đăng nhập.
- Tài khoản Admin đang hoạt động và có quyền quản lý user.

## Kích hoạt

Có nhân sự mới, nhân sự nghỉ việc hoặc cần thay đổi quyền của người dùng.

## Luồng chính

1. Admin mở chức năng **Quản lý tài khoản**.
2. Hệ thống hiển thị danh sách tài khoản có phân trang, tìm kiếm và lọc theo vai trò.
3. Admin chọn một thao tác:
   - Thêm tài khoản: thực hiện luồng con S1.
   - Sửa thông tin hoặc gán vai trò: thực hiện luồng con S2.
   - Khóa hoặc mở khóa: thực hiện luồng con S3.
   - Xóa tài khoản: thực hiện luồng con S4.
4. Hệ thống lưu thay đổi và ghi audit log gồm người thao tác, hành động, tài khoản bị tác động và thời điểm.
5. Hệ thống cập nhật danh sách tài khoản.

## Luồng con

### S1 — Thêm tài khoản

1. Admin nhập họ tên, email, mật khẩu tạm thời và vai trò.
2. Hệ thống kiểm tra dữ liệu và email chưa được sử dụng.
3. Hệ thống băm mật khẩu rồi tạo tài khoản.
4. Hệ thống ghi audit log và hiển thị tài khoản mới.

### S2 — Sửa thông tin hoặc gán vai trò

1. Admin chọn tài khoản và cập nhật thông tin được phép hoặc vai trò.
2. Vai trò hợp lệ: `ADMIN`, `MANAGER`, `TEACHER`, `MEDICAL_STAFF`, `PARENT`.
3. Hệ thống lưu thay đổi và ghi lại giá trị trước/sau trong audit log (không ghi mật khẩu/token).

### S3 — Khóa hoặc mở khóa

1. Admin chọn tài khoản và trạng thái mới.
2. Hệ thống cập nhật trạng thái.
3. Tài khoản bị khóa không thể đăng nhập.
4. Hệ thống ghi audit log.

### S4 — Xóa tài khoản

1. Admin chọn tài khoản.
2. Hệ thống yêu cầu xác nhận.
3. Nếu Admin xác nhận, hệ thống xóa tài khoản theo chính sách lưu dữ liệu của dự án và ghi audit log.

## Luồng thay thế và lỗi

- **S1a — Email đã tồn tại:** báo lỗi và yêu cầu nhập email khác.
- **S4a — Hủy xác nhận:** không thay đổi dữ liệu, quay lại danh sách.
- **S3a/S4b — Tự khóa hoặc tự xóa:** từ chối thao tác trên chính tài khoản Admin đang dùng.
- **E-AUTH — Không đủ quyền:** từ chối thao tác và không thay đổi dữ liệu.
- **Lỗi lưu database:** rollback thay đổi, báo lỗi; không ghi một phần dữ liệu.

## Hậu điều kiện

- Tài khoản được tạo/cập nhật/khóa/mở khóa/xóa theo thao tác hợp lệ.
- Thao tác quản trị có audit log.
- Mật khẩu không được lưu hoặc trả về dạng thuần.

## Quy tắc nghiệp vụ và bảo mật

- Chỉ Admin được dùng các thao tác quản trị trong use case này.
- Email là duy nhất; chuẩn hóa email trước khi so sánh.
- Mật khẩu tạm phải được băm trước khi lưu; API không trả `password_hash`.
- Không cho Admin tự khóa hoặc tự xóa tài khoản đang sử dụng.
- **Quyết định cần chốt trước khi code:** use case nguồn có thao tác xóa. Nếu cần bảo toàn lịch sử nghiệp vụ, dùng soft delete/trạng thái ngừng hoạt động; nếu xóa vật lý, phải xác định rõ xử lý các khóa ngoại và audit trước.

## API dự kiến

- `GET /users?query=&role=&status=&page=&limit=`
- `POST /users`
- `PATCH /users/:id`
- `PATCH /users/:id/role`
- `PATCH /users/:id/status`
- `GET /audit-logs?actorUserId=&action=&resourceType=&from=&to=&page=&limit=` (Admin)
- API xóa/soft delete chỉ chốt sau khi nhóm quyết định chính sách ở trên.

## Tiêu chí chấp nhận

- Admin xem được danh sách có tìm kiếm, lọc vai trò và phân trang.
- Admin thêm tài khoản; email trùng bị từ chối.
- Admin sửa thông tin, đổi role và khóa/mở khóa tài khoản.
- Tài khoản bị khóa không đăng nhập được.
- User không phải Admin nhận `403`; request chưa đăng nhập nhận `401`.
- Admin không thể tự khóa hoặc xóa chính mình.
- Thao tác được ghi audit log; response không chứa mật khẩu/hash.
