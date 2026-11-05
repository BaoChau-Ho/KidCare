# UC-07 — Theo dõi tình hình của con

| Thuộc tính | Nội dung |
|---|---|
| Mã | UC-07 |
| Tác nhân | Phụ huynh |
| Yêu cầu | FR-ATT-04, FR-ATT-05, FR-HEALTH-04, FR-ACT-03 |

## Mục tiêu và điều kiện

Phụ huynh xem điểm danh, thông tin sức khỏe được phép và hoạt động của trẻ đã liên kết với tài khoản.

## Luồng chính

1. Dashboard tải danh sách con đã liên kết.
2. Phụ huynh chọn trẻ và xem trạng thái điểm danh hôm nay.
3. Chọn lịch sử điểm danh, tóm tắt sức khỏe hoặc hoạt động.
4. Backend kiểm tra quan hệ phụ huynh-trẻ trước mỗi truy vấn.

## Ngoại lệ và bảo mật

Không có trẻ liên kết thì hiển thị hướng dẫn liên hệ nhà trường. ID trẻ không thuộc phụ huynh bị từ chối; không có dữ liệu hiển thị empty state.

## API

Dùng `/children/{childId}/attendance/today`, `/children/{childId}/attendance`, `/children/{childId}/health-summary`, `/children/{childId}/activities` và API liệt kê trẻ trong phạm vi tài khoản.

## Tiêu chí chấp nhận

Phụ huynh chỉ đọc được trẻ đã liên kết; đổi ID trên URL không lấy được dữ liệu của gia đình khác; nội dung sức khỏe được giới hạn theo chính sách.
