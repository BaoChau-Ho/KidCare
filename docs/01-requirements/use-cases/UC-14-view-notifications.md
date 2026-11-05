# UC-14 — Xem thông báo

| Thuộc tính | Nội dung |
|---|---|
| Mã | UC-14 |
| Tác nhân | Tất cả người dùng |
| Yêu cầu | FR-NOTI-01, FR-NOTI-03 |

## Mục tiêu và điều kiện

Người dùng xem thông báo đã gửi riêng cho mình, phân biệt chưa đọc và đánh dấu đã đọc.

## Luồng chính

1. Tải inbox phân trang và số chưa đọc.
2. Mở thông báo.
3. Backend chỉ trả thông báo có recipient là user từ JWT và cập nhật read time.

## Ngoại lệ

Inbox rỗng hiển thị trạng thái phù hợp; truy cập ID notification của user khác bị từ chối.

## API và bảo mật

`GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/{notificationId}/read`. Không tin recipient id từ request client.

## Tiêu chí chấp nhận

Unread count chính xác; đánh dấu đọc lặp lại an toàn; IDOR bị chặn; phân trang ổn định.
