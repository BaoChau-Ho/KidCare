# Stage 4 — Hồ sơ sức khỏe (UC-09)

## Tình trạng hiện tại

Chưa có entity/module hồ sơ sức khỏe trong backend. Phụ thuộc Stage 2 có trẻ và Stage 1/2 có xác thực, role và phạm vi truy cập. OpenAPI hiện mô tả các endpoint nhưng chưa có code tương ứng.

## Việc cần làm

1. Chốt đơn vị đo, retention, trường phụ huynh được xem và ngưỡng cảnh báo.
2. Tạo entity cho health records, allergies, conditions, vaccinations, medical visits và medications theo ERD.
3. Tạo migration mới, FK/index theo child và thời gian.
4. Trong `backend/src/health-records/` (hoặc thống nhất dùng `health/`), triển khai DTO/service/controller.
5. Chỉ MEDICAL_STAFF được ghi; parent chỉ đọc trẻ liên kết; teacher chỉ nhận dữ liệu cần cho an toàn.
6. Audit thay đổi và tránh log thông tin nhạy cảm; gửi cảnh báo sau khi notification integration sẵn sàng.
7. Làm UI hồ sơ y tế và parent view.

## Điều kiện hoàn tất

Validation số đo, lịch sử không bị ghi đè mất dấu, kiểm tra role/child ownership phía server, audit và OpenAPI đồng bộ, migration chạy được.
