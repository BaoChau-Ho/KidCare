# Stage 3 — Điểm danh, dashboard phụ huynh và nghỉ học (UC-06–08)

## Tình trạng hiện tại

Chưa có module/entity attendance, leave request hoặc child trong backend. Stage này phụ thuộc Stage 2 hoàn tất tối thiểu `Child`, `Classroom`, phân công giáo viên và liên kết phụ huynh. Auth hiện đã có JWT guard nhưng chưa có role Manager/Teacher/Parent scope guard.

## Mục tiêu và database

- `Attendance`: child, date, status, check-in/out timestamps, recorded-by; unique `(child_id, date)`.
- `LeaveRequest`: child, requester, date range, reason, status, timestamps; kiểm tra trùng/overlap theo quy tắc đã chốt.
- Tạo migration mới sau khi entity ổn định; thêm index theo lớp/ngày và trẻ/ngày.

## Bước triển khai

1. Tạo `backend/src/attendance/` entity, DTO, service, controller, module.
2. Tạo roster theo lớp/ngày; giáo viên chỉ xem lớp được phân công.
3. Check-in/out kiểm tra trình tự và trạng thái; lưu cùng actor trong transaction.
4. Thêm phụ huynh xem trạng thái hôm nay/lịch sử. Mọi truy vấn xác minh quan hệ CHILD_PARENT phía server.
5. Tạo `backend/src/leave-requests/`; validate ngày, child ownership và đơn trùng.
6. Chốt đơn nghỉ có hiệu lực ngay hay cần duyệt; cập nhật trạng thái attendance nhất quán.
7. Cập nhật OpenAPI/UI; chưa kết nối notification nếu chưa có module đó, có thể tạo interface tích hợp.

## Frontend

Màn hình điểm danh theo lớp/ngày; Parent dashboard; gửi đơn nghỉ; phân trang và trạng thái loading/error/empty.

## Điều kiện hoàn tất

Lớp ngoài quyền, check-out trước check-in, record trùng ngày, child ngoài quan hệ phụ huynh và đơn nghỉ không hợp lệ đều bị chặn; transaction rollback; OpenAPI/UI/CI đồng bộ.
