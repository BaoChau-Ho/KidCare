# UC-12 — Xác nhận đón trẻ

| Thuộc tính | Nội dung |
|---|---|
| Mã | UC-12 |
| Tác nhân | Giáo viên |
| Yêu cầu | FR-PICK-02 đến FR-PICK-05 |

## Mục tiêu và điều kiện

Giáo viên đối chiếu người đến đón, duyệt/từ chối yêu cầu, rồi xác nhận đã giao trẻ.

## Luồng chính

1. Xem yêu cầu trong ngày của lớp.
2. Đối chiếu danh tính người đón.
3. Duyệt hoặc từ chối kèm lý do.
4. Khi giao trẻ, hoàn tất yêu cầu, ghi verifier/time và thực hiện check-out UC-06.
5. Thông báo phụ huynh.

## Ngoại lệ

Không tìm thấy yêu cầu hoặc giấy tờ không khớp thì không giao trẻ; yêu cầu đã được người khác xử lý trả conflict.

## API và quyền

`GET /pickup-requests`, `PATCH /pickup-requests/{requestId}/approve|reject|complete`. Chỉ giáo viên được phân công lớp xử lý. Hoàn tất pickup và check-out phải nguyên tử.

## Tiêu chí chấp nhận

Không xử lý hoàn tất hai lần; check-out khớp; mọi thao tác có actor/time; lớp ngoài phạm vi bị chặn.
