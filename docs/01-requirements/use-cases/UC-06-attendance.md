# UC-06 — Điểm danh trẻ

| Thuộc tính | Nội dung |
|---|---|
| Mã | UC-06 |
| Tác nhân | Giáo viên |
| Yêu cầu | FR-ATT-01 đến FR-ATT-03, FR-ATT-06 |

## Mục tiêu và điều kiện

Giáo viên ghi nhận trẻ đến lớp và được đón về. Giáo viên phải được phân công lớp; trẻ phải thuộc lớp đó và đang theo học.

## Luồng chính

1. Giáo viên chọn lớp/ngày và xem roster cùng trạng thái hiện tại.
2. Check-in ghi thời gian đến và người thao tác; trạng thái là PRESENT hoặc LATE theo giờ quy định.
3. Check-out ghi thời gian về; có thể đánh dấu EARLY_LEAVE.
4. Hệ thống lưu nguyên tử và cập nhật trạng thái cho phụ huynh.

## Ngoại lệ

Trẻ có đơn nghỉ hiển thị ABSENT; check-out trước check-in bị từ chối; mỗi trẻ chỉ có một bản ghi/ngày; lỗi DB rollback.

## API

`GET /classes/{classId}/attendance`, `POST /attendance/check-in`, `POST /attendance/check-out`, `PATCH /attendance/{attendanceId}`, và lịch sử theo trẻ.

## Quyền và tiêu chí chấp nhận

JWT; giáo viên chỉ thao tác lớp được phân công. Không tạo bản ghi trùng ngày; giờ check-in/out hợp lệ; lớp ngoài quyền bị chặn; lịch sử giữ actor và timestamp.
