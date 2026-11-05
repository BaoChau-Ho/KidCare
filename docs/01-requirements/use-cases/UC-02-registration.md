# UC-02 — Đăng ký tài khoản

| Thuộc tính | Nội dung |
|---|---|
| Mã | UC-02 |
| Tác nhân | Phụ huynh (theo use case nguồn) |
| Yêu cầu | FR-AUTH-01 |
| Trạng thái tài liệu | Đặc tả; quy trình hiện thực cần được đối chiếu với OpenAPI và code |

## Mục tiêu và điều kiện

Người dùng gửi yêu cầu mở tài khoản. Use case nguồn mô tả phụ huynh đăng ký; tài khoản có role `parent`. Email và số giấy tờ không được trùng.

## Luồng chính

1. Người dùng nhập họ tên, email, điện thoại, role được phép theo quy trình, CCCD và mật khẩu.
2. Backend validate dữ liệu, chuẩn hóa email, hash mật khẩu và kiểm tra trùng.
3. Tạo user/request ở trạng thái `pending`.
4. Admin duyệt hoặc từ chối yêu cầu.
5. Khi được duyệt, tài khoản chuyển sang `active`; nếu bị từ chối, lưu lý do.

## Ngoại lệ

Dữ liệu sai trả lỗi tại trường; email/CCCD trùng trả conflict; người dùng không được tự đăng ký role `admin`.

## API và điểm cần thống nhất

Code hiện có `POST /auth/register`, `/admin/registration-requests`, các route approve/reject và thiết lập mật khẩu. OpenAPI hiện có một số đường dẫn/response chưa khớp code. Cần quyết định rõ: chỉ PARENT được tự đăng ký hay client được chọn trong các role được cho phép; admin duyệt thì dùng mật khẩu đã nhập hay gửi link thiết lập mật khẩu.

## Tiêu chí chấp nhận

Request hợp lệ lưu ở trạng thái pending; role admin không thể tự cấp; trùng email/CCCD bị từ chối; chỉ admin duyệt/từ chối; tài khoản pending không đăng nhập.
