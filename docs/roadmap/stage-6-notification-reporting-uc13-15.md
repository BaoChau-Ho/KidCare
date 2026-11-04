# Stage 6 — Thông báo và báo cáo (UC-13–15)

## Tình trạng hiện tại

Chưa có notification/reporting entity hoặc module trong backend. OpenAPI đã mô tả các endpoint dự kiến. Báo cáo phụ thuộc dữ liệu Stage 3–5; notification nhận sự kiện từ attendance, health, activity và pickup.

## Bước triển khai

1. Tạo `Notification` với recipient, sender (nullable cho system), type, title/body, related resource, created/read timestamps.
2. Tạo inbox phân trang, unread count và mark-read; recipient luôn lấy từ JWT.
3. Broadcast cho phụ huynh cả lớp/nhóm trẻ; xác minh assignment và child-parent trên server.
4. Kết nối notification event từ các module trước. Với MVP có thể ghi trong transaction; đánh giá outbox nếu cần đảm bảo gửi tin cậy.
5. Tạo report attendance/classes/health bằng truy vấn aggregate; validate ngày và phạm vi manager.
6. Tạo index theo recipient/read/time và filter báo cáo; thêm UI inbox/báo cáo.

## Điều kiện hoàn tất

Không đọc được thông báo user khác; unread count đúng; broadcast đúng người nhận; report khớp dữ liệu nguồn; quyền và ngày lọc được validate.
