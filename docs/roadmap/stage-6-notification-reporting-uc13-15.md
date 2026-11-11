# Stage 6 — Thông báo và báo cáo (UC-13–15)

## Tình trạng hiện tại

Notification entity/module inbox cơ bản đã được triển khai để nhận thông báo cập nhật hồ sơ sức khỏe (UC-09). Broadcast UC-13, tích hợp sự kiện attendance/activity/pickup và reporting UC-15 vẫn chưa triển khai. OpenAPI đã mô tả các endpoint dự kiến. Báo cáo phụ thuộc dữ liệu Stage 3–5.

## Bước triển khai

1. **Hoàn tất cho inbox:** tạo `Notification` với recipient, sender (nullable cho system), type, title/body, related resource, created/read timestamps.
2. **Hoàn tất cho inbox:** phân trang, unread count, mark-read/read-all; recipient luôn lấy từ JWT.
3. Broadcast cho phụ huynh cả lớp/nhóm trẻ; xác minh assignment và child-parent trên server.
4. **Hoàn tất một phần:** nối sự kiện health-record.changed để gửi thông báo cập nhật sức khỏe cho phụ huynh liên kết. Còn tích hợp attendance/activity/pickup và cần đánh giá outbox nếu cần đảm bảo gửi tin cậy.
5. Tạo report attendance/classes/health bằng truy vấn aggregate; validate ngày và phạm vi manager.
6. Tạo index theo recipient/read/time và filter báo cáo; thêm UI inbox/báo cáo.

## Điều kiện hoàn tất

Không đọc được thông báo user khác; unread count đúng; broadcast đúng người nhận; report khớp dữ liệu nguồn; quyền và ngày lọc được validate.
