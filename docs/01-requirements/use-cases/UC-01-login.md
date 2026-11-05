# UC-01 — Đăng nhập

| Thuộc tính | Nội dung |
|---|---|
| Mã | UC-01 |
| Tác nhân | Tất cả người dùng |
| Yêu cầu | FR-AUTH-02, FR-AUTH-03 |
| Trạng thái tài liệu | Đặc tả; chưa tự khẳng định mức hoàn thành triển khai |

## Mục tiêu và điều kiện

Người dùng xác thực bằng email/mật khẩu, nhận phiên đăng nhập và được điều hướng theo role. Tài khoản phải tồn tại và đang hoạt động.

## Luồng chính

1. Người dùng nhập email và mật khẩu.
2. Backend kiểm tra dữ liệu, chuẩn hóa email và so sánh mật khẩu với hash đã lưu.
3. Nếu tài khoản hợp lệ, hệ thống tạo access token và trả thông tin người dùng đã loại bỏ thông tin xác thực.
4. Frontend lưu phiên theo chính sách bảo mật và điều hướng đến trang phù hợp với role.

## Ngoại lệ

- Thiếu hoặc sai định dạng: trả lỗi validation.
- Email/mật khẩu không đúng: trả thông báo chung, không tiết lộ email có tồn tại hay không.
- Tài khoản `pending` hoặc `disabled`: từ chối đăng nhập.
- Thử sai nhiều lần: áp dụng rate limit nếu được triển khai.

## API và bảo mật

`POST /auth/login`, `GET /auth/me`; luồng đăng xuất hiện do client xóa phiên. Password hash không được trả về hoặc ghi log. Các endpoint nghiệp vụ xác thực JWT phía server.

## Tiêu chí chấp nhận

Đăng nhập đúng trả user/role/token; sai thông tin và tài khoản không hoạt động bị chặn; token sai/hết hạn nhận 401; không lộ password hash.
