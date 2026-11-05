# UC-10 — Tạo hoạt động

| Thuộc tính | Nội dung |
|---|---|
| Mã | UC-10 |
| Tác nhân | Giáo viên |
| Yêu cầu | FR-ACT-01, FR-ACT-02, FR-ACT-05 |

## Mục tiêu và điều kiện

Giáo viên tạo hoạt động của lớp, ghi nhận trẻ tham gia và tùy chọn đính kèm ảnh. Giáo viên phải được phân công lớp.

## Luồng chính

1. Chọn lớp, nhập tiêu đề/mô tả/ngày.
2. Chọn trẻ tham gia.
3. Tải ảnh nếu cần; backend kiểm tra loại và dung lượng.
4. Lưu hoạt động, participant và metadata ảnh; thông báo phụ huynh liên quan.

## Ngoại lệ

Lớp ngoài phạm vi bị từ chối; thiếu tiêu đề/ngày báo validation; ảnh sai loại/quá lớn bị từ chối.

## API và quyền

`GET/POST /activities`, `POST /activities/{activityId}/participants`, `POST /activities/{activityId}/images`, `GET /children/{childId}/activities`. Giáo viên chỉ ghi hoạt động cho lớp được phân công; phụ huynh chỉ xem hoạt động của con.

## Tiêu chí chấp nhận

Participant thuộc lớp; dữ liệu và file không lưu dở dang; phụ huynh không đọc hoạt động trẻ khác; kiểm tra giới hạn upload ở backend.
