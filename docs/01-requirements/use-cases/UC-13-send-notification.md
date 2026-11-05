# UC-13 — Gửi thông báo cho phụ huynh

| Thuộc tính | Nội dung |
|---|---|
| Mã | UC-13 |
| Tác nhân | Giáo viên |
| Yêu cầu | FR-NOTI-02 |

## Mục tiêu và điều kiện

Giáo viên gửi thông báo trong ứng dụng tới phụ huynh cả lớp hoặc một nhóm trẻ trong lớp mình phụ trách.

## Luồng chính

1. Chọn lớp hoặc trẻ nhận.
2. Nhập tiêu đề/nội dung.
3. Backend xác minh phạm vi, tìm người nhận qua child-parent và tạo notification cho từng người.

## Ngoại lệ

Thiếu nội dung hoặc không có người nhận trả lỗi/empty result rõ ràng. Không cho gửi tới lớp ngoài phân công.

## API và quyền

`POST /notifications/broadcast`; chỉ TEACHER phụ trách lớp. Recipient được suy ra từ server-side relationship, không nhận danh sách tùy ý nếu không kiểm tra quyền.

## Tiêu chí chấp nhận

Người nhận đúng, không trùng; nội dung validate; thao tác lưu người gửi và thời điểm.
