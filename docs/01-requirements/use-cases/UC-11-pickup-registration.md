# UC-11 — Đăng ký người đón trẻ

| Thuộc tính | Nội dung |
|---|---|
| Mã | UC-11 |
| Tác nhân | Phụ huynh |
| Yêu cầu | FR-PICK-01 |

## Mục tiêu và điều kiện

Phụ huynh đăng ký trước người được phép đón trẻ đã liên kết với tài khoản.

## Luồng chính

1. Nhập trẻ, người đón, giấy tờ và thời gian dự kiến.
2. Backend xác minh quyền, kiểm tra dữ liệu và thời gian.
3. Tạo yêu cầu PENDING, thông báo giáo viên lớp.

## Ngoại lệ

Thiếu thông tin hoặc thời gian trong quá khứ bị từ chối. Phụ huynh có thể hủy khi yêu cầu còn PENDING.

## API và bảo mật

`POST/GET /pickup-requests`, `PATCH /pickup-requests/{requestId}/cancel`. Chỉ phụ huynh liên kết mới tạo/hủy; thông tin giấy tờ chỉ trả cho người có quyền xác minh.

## Tiêu chí chấp nhận

Trạng thái chuyển hợp lệ; yêu cầu hủy không thể tiếp tục duyệt; thông báo đúng lớp; dữ liệu định danh không bị lộ sang tài khoản khác.
