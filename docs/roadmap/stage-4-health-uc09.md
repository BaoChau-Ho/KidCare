# Stage 4 — Hồ sơ sức khỏe (UC-09)

## Tình trạng hiện tại

Backend Stage 4 đã được triển khai theo hợp đồng trong `docs/02-design/openapi.yaml`: entity và migration cho số đo, dị ứng, bệnh nền, tiêm chủng, lần khám và thuốc; DTO validation; API CRUD/list; tóm tắt theo vai trò; cảnh báo sức khỏe theo lớp; kiểm tra quyền; audit log không lưu nội dung ghi chú, triệu chứng hoặc kết luận.

Các migration `1794268800000` đến `1794268800004` đã được áp dụng vào database trong quá trình làm việc. Backend build đã chạy thành công. Các kiểm tra API thủ công đã được thực hiện với tài khoản nhân viên y tế; người học đã chạy bộ E2E Stage 4 trên database test và xác nhận đạt.

Frontend Stage 4 đã có màn hình nhân viên y tế và view tóm tắt sức khỏe. Backend cho phép nhân viên y tế đọc danh sách lớp và trẻ qua response rút gọn để các màn hình đó dùng backend thật. Ngày 11/11/2026 đã kiểm tra luồng với `VITE_USE_MOCK=false`: nhân viên y tế mở được hồ sơ và các tab; phụ huynh `parent2@demo.com` xem được tóm tắt sức khỏe của trẻ đã liên kết, gồm lịch tiêm và lần khám gần đây, không thấy phần kết luận y tế dành riêng cho nhân viên.

## Việc cần làm

1. **Đã chốt** đơn vị cm, kg, °C; khoảng hợp lệ; ngưỡng nhiệt độ cảnh báo; trường phụ huynh/giáo viên được xem trong `openapi.yaml`; retention tạm thời là không tự động xóa hồ sơ.
2. **Hoàn tất:** entity cho số đo, dị ứng, bệnh nền, tiêm chủng, lần khám và thuốc theo ERD.
3. **Hoàn tất:** năm migration với FK/index; đã áp dụng vào database.
4. **Hoàn tất:** DTO, service, controller trong `backend/src/health-records/`.
5. **Hoàn tất:** phân quyền MEDICAL_STAFF ghi; PARENT chỉ đọc trẻ liên kết; TEACHER chỉ nhận thông tin an toàn cần thiết.
6. **Hoàn tất:** audit không ghi nội dung ghi chú/triệu chứng/kết luận. Thông báo inbox sức khỏe được gửi cho phụ huynh liên kết sau mỗi cập nhật hồ sơ; nội dung thông báo không tiết lộ chi tiết y tế.
7. **Hoàn tất:** UI nhân viên y tế và parent view đã mở được với backend thật; parent summary đã kiểm tra lọc trường nhạy cảm.

## Còn mở

- Retention hiện tạm thời không tự động xóa hồ sơ; cần chốt thời hạn chính thức trước khi vận hành dài hạn.
- Đã có notification inbox cơ bản cho cập nhật hồ sơ sức khỏe. Broadcast UC-13 và báo cáo UC-15 vẫn thuộc Stage 6.
- Luồng UI nhân viên y tế và view sức khỏe phụ huynh đã được kiểm tra với backend thật ngày 11/11/2026.

## Điều kiện hoàn tất backend

Validation số đo, lịch sử không bị ghi đè mất dấu, kiểm tra role/child ownership phía server, audit và OpenAPI đồng bộ, migration chạy được, build thành công. Các phần này đã được triển khai; E2E Stage 4 đã được người học xác nhận đạt.
