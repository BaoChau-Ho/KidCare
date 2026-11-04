# Stage 1 — Authentication và đăng ký (UC-01, UC-02)

## Mục tiêu

Xác thực người dùng, tạo access token, quản lý yêu cầu đăng ký phụ huynh và giới hạn API theo trạng thái/role.

## Tình trạng hiện tại trong repo

Đã có login bằng Argon2, JWT guard, AdminGuard, `GET /auth/me`, đăng ký tạo user/request trạng thái `pending`, admin xem/duyệt/từ chối yêu cầu, kiểm tra link và đặt mật khẩu. Có seed admin ở `backend/src/users/seed-admin.ts`; frontend có trang login/register/set-password/admin requests. Các migration registration request, user profile và `ChangeUserIdToUuid` đã có trong `backend/src/database/migrations/`. `User.id` và JWT guard hiện dùng UUID; `registration_requests.id` vẫn là SERIAL và controller vẫn dùng ParseIntPipe.

Chưa hoàn tất/đang lệch giữa các lớp:

- Chưa có API logout/thu hồi token; giao diện logout chỉ xóa sessionStorage, token server vẫn sống đến khi hết hạn.
- Migration UUID tạo UUID mới cho mỗi user; migration `down` hiện cũng tạo lại số nguyên mới, không khôi phục ID cũ. Cần xác nhận trạng thái migration và kế hoạch backup trước khi áp dụng trên DB có dữ liệu.
- Code hiện yêu cầu người đăng ký chọn role trong danh sách non-admin, trong khi UC-02 nguồn chỉ mô tả phụ huynh tự đăng ký.
- Code admin approve hiện kích hoạt user có password đã nhập khi đăng ký; OpenAPI lại mô tả link thiết lập password sau duyệt. `set-password` có trong backend nhưng flow approve hiện không phát link.
- OpenAPI có endpoint/path/response chưa khớp route thực tế; cần đồng bộ trước khi frontend chuyển hết sang API thật.
- Frontend lưu access token trong sessionStorage; đây là quyết định bảo mật cần được nhóm chấp thuận/đánh giá.

## Việc cần làm tiếp

1. Chốt UC-02: role nào được tự đăng ký và quy trình đặt password/duyệt.
2. Đồng bộ OpenAPI với route/DTO/response thực tế; thống nhất ID user là integer và enum viết thường theo backend.
3. Chốt ID: dùng UUID nhất quán cho các resource/API; chuyển `registration_requests.id` từ SERIAL nếu không có quyết định ngoại lệ, vì OpenAPI đang mô tả UUID.
4. Chốt logout: chấp nhận JWT sống tối đa 1 giờ hay thêm session/revocation.
5. Xác nhận seed admin dùng secret riêng từ `.env`, không commit credential.
6. Hoàn thiện kiểm tra route/role phía server; UI route guard chỉ hỗ trợ UX, không thay guard backend.
7. Cấu hình test scripts backend; hiện `backend/package.json` chưa có `test`/`test:e2e` scripts.

## Điều kiện hoàn tất

Flow login, đăng ký, duyệt/từ chối và đặt mật khẩu khớp giữa UI/API/OpenAPI; pending/disabled không đăng nhập; token/role được bảo vệ phía server; logout/revocation có hành vi đã chốt; migration và seed chạy được trên DB sạch; CI không gọi script test chưa tồn tại.
