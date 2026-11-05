# UC-09 — Quản lý hồ sơ sức khỏe

| Thuộc tính | Nội dung |
|---|---|
| Mã | UC-09 |
| Tác nhân | Nhân viên y tế |
| Yêu cầu | FR-HEALTH-01 đến FR-HEALTH-07 |

## Mục tiêu và điều kiện

Nhân viên y tế ghi nhận chỉ số, dị ứng, bệnh nền, tiêm chủng, khám và thuốc của trẻ.

## Luồng chính

1. Tìm trẻ và xem hồ sơ/lịch sử.
2. Thêm/cập nhật chỉ số hoặc thông tin y tế phù hợp.
3. Backend validate giá trị, lưu bản ghi và audit actor/thay đổi.
4. Khi có dữ liệu mới hoặc cảnh báo, gửi thông báo cho các vai trò được phép.

## Ngoại lệ

Số đo ngoài miền hợp lý bị từ chối hoặc đánh dấu cần xác minh; người không có quyền không xem/sửa hồ sơ.

## API

`/children/{childId}/health-records`, `/health-records/{recordId}`, `/children/{childId}/health-summary`, `/children/{childId}/vaccinations`, `/children/{childId}/medical-visits`, `/classes/{classId}/health-alerts`.

## Bảo mật và tiêu chí chấp nhận

Chỉ MEDICAL_STAFF ghi; phụ huynh chỉ đọc trẻ được liên kết; giáo viên chỉ nhận thông tin cần cho an toàn. Audit không chứa password/token. Lịch sử và quyền truy cập được kiểm chứng.
