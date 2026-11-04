# Use case catalog — KidCare

Các đặc tả UC được tách thành file riêng để dễ cập nhật cùng API, ERD và code. Nội dung là yêu cầu thiết kế; không khẳng định tính năng đã được triển khai.

| UC | Use case | Đặc tả |
|---|---|---|
| UC-01 | Đăng nhập | [UC-01-login.md](UC-01-login.md) |
| UC-02 | Đăng ký tài khoản | [UC-02-registration.md](UC-02-registration.md) |
| UC-03 | Quản lý tài khoản người dùng | [UC-03-user-management.md](UC-03-user-management.md) |
| UC-04 | Quản lý hồ sơ trẻ | [UC-04-child-management.md](UC-04-child-management.md) |
| UC-05 | Quản lý lớp và phân công giáo viên | [UC-05-class-management.md](UC-05-class-management.md) |
| UC-06 | Điểm danh trẻ | [UC-06-attendance.md](UC-06-attendance.md) |
| UC-07 | Theo dõi tình hình của con | [UC-07-parent-dashboard.md](UC-07-parent-dashboard.md) |
| UC-08 | Gửi yêu cầu nghỉ học | [UC-08-leave-request.md](UC-08-leave-request.md) |
| UC-09 | Quản lý hồ sơ sức khỏe | [UC-09-health-record.md](UC-09-health-record.md) |
| UC-10 | Tạo hoạt động | [UC-10-activity.md](UC-10-activity.md) |
| UC-11 | Đăng ký người đón trẻ | [UC-11-pickup-registration.md](UC-11-pickup-registration.md) |
| UC-12 | Xác nhận đón trẻ | [UC-12-pickup-confirmation.md](UC-12-pickup-confirmation.md) |
| UC-13 | Gửi thông báo cho phụ huynh | [UC-13-send-notification.md](UC-13-send-notification.md) |
| UC-14 | Xem thông báo | [UC-14-view-notifications.md](UC-14-view-notifications.md) |
| UC-15 | Xem báo cáo | [UC-15-reports.md](UC-15-reports.md) |

## Cần thống nhất

- UC-02: use case nguồn mô tả tạo tài khoản phụ huynh trực tiếp; OpenAPI hiện tại mô tả yêu cầu chờ admin duyệt rồi thiết lập mật khẩu.
- UC-08: cần chốt đơn nghỉ có hiệu lực ngay hay cần giáo viên duyệt.
- Các ID trong ERD/OpenAPI đang là UUID, còn entity `User` hiện tại dùng số nguyên.
