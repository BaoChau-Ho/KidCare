# Stage 5 — Hoạt động và đón trẻ (UC-10–12)

## Tình trạng hiện tại

Chưa có activity hoặc pickup entity/module trong backend. Activity phụ thuộc lớp/child/teacher; pickup ngoài các quan hệ đó còn tích hợp check-out của UC-06.

## Bước triển khai

1. Activity: tạo `Activity`, `ActivityParticipant`, `ActivityImage`; unique `(activity_id, child_id)`.
2. Cho giáo viên tạo hoạt động trong lớp được phân công; phụ huynh chỉ xem hoạt động của trẻ liên kết.
3. Ảnh lưu object storage; DB lưu metadata và object key. Nếu chưa có storage, giới hạn demo/local và ghi rõ.
4. Pickup: `PickupRequest` lưu child, requester, người đón, trạng thái, thời gian, verifier và lý do.
5. Parent tạo/hủy yêu cầu PENDING; teacher lớp approve/reject; chỉ APPROVED mới complete.
6. Complete phải thực hiện check-out và đổi pickup status trong transaction, tránh race/double completion.
7. Cập nhật UI, OpenAPI, migration; tích hợp notification ở Stage 6.
   OpenAPI đã chốt ngày 09/11/2026 (nhóm Activities, Pickup): quyền theo vai trò, ảnh JPEG/PNG/WEBP tối đa 2 MB và 6 ảnh mỗi hoạt động, giấy tờ CMND 9 số hoặc CCCD 12 số (chỉ giáo viên của lớp thấy đủ), điều kiện hoàn tất đón trẻ.
   E2E viết trước theo hợp đồng này: `backend/test/e2e/stage-5-activity-pickup.e2e-spec.ts`, tự chạy khi có controller.

## Điều kiện hoàn tất

Quyền lớp/child được kiểm tra phía server; upload có giới hạn; dữ liệu giấy tờ chỉ hiện cho role cần thiết; state transition hợp lệ; hoàn tất pickup tạo check-out đúng một lần.
