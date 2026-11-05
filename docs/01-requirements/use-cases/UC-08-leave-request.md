# UC-08 — Gửi yêu cầu nghỉ học

| Thuộc tính | Nội dung |
|---|---|
| Mã | UC-08 |
| Tác nhân | Phụ huynh |
| Yêu cầu | FR-ATT-07 |

## Mục tiêu và điều kiện

Phụ huynh báo ngày nghỉ của trẻ đã liên kết để giáo viên biết trước.

## Luồng chính

1. Chọn trẻ, ngày bắt đầu/kết thúc và lý do.
2. Backend xác minh quyền phụ huynh, khoảng ngày và yêu cầu trùng.
3. Lưu yêu cầu, thông báo giáo viên phụ trách và trả trạng thái.

## Ngoại lệ

Ngày quá khứ, ngày kết thúc trước ngày bắt đầu hoặc đơn trùng bị từ chối. Phụ huynh không được gửi đơn cho trẻ chưa liên kết.

## API và quyết định

`POST /leave-requests`, `GET /leave-requests`; OpenAPI còn mô tả approve/reject. Use case nguồn không chốt việc duyệt: nhóm cần quyết định đơn có hiệu lực ngay hay chờ giáo viên.

## Tiêu chí chấp nhận

Ngày hợp lệ; đơn trùng bị chặn; thông báo đến đúng lớp; quyền phụ huynh kiểm tra ở backend.
