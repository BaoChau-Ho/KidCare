# UC-15 — Xem báo cáo

| Thuộc tính | Nội dung |
|---|---|
| Mã | UC-15 |
| Tác nhân | Quản lý cơ sở |
| Yêu cầu | FR-REP-01 đến FR-REP-05 |

## Mục tiêu và điều kiện

Quản lý xem báo cáo điểm danh, sức khỏe và hoạt động, lọc theo lớp và khoảng thời gian.

## Luồng chính

1. Chọn loại báo cáo, lớp và khoảng ngày.
2. Backend validate bộ lọc/quyền và tổng hợp dữ liệu nguồn.
3. Trả kết quả cho bảng/biểu đồ.

## Ngoại lệ

Ngày bắt đầu sau ngày kết thúc bị từ chối; không có dữ liệu trả kết quả rỗng thay vì lỗi.

## API và quyền

`GET /reports/attendance`, `GET /reports/classes`, `GET /reports/health`; yêu cầu đăng nhập và role MANAGER theo phạm vi dữ liệu được phân quyền.

## Tiêu chí chấp nhận

Số liệu khớp dữ liệu nguồn; filter ngày/lớp chính xác; không lộ dữ liệu cá nhân sức khỏe nếu báo cáo chỉ cần số tổng hợp.
