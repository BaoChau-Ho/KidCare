// Increment 2 — hồ sơ trẻ và liên kết phụ huynh (UC-04, UC-07).
// Mã test case: docs/03-testing/Test_Cases.md. API: docs/02-design/openapi.yaml.
// Đang ở dạng it.todo vì module children chưa được code. Khi API được merge vào main,
// thay it.todo bằng it(...) và dùng createTestApp() trong ./helpers/app.

describe('Inc 2 — Hồ sơ trẻ (e2e)', () => {
  it.todo('TC-CHILD-01 quản lý tạo hồ sơ trẻ hợp lệ → 201, trạng thái ACTIVE');
  it.todo('TC-CHILD-02 tạo trẻ thiếu trường bắt buộc → 400');
  it.todo('TC-CHILD-03 liên kết phụ huynh với quan hệ FATHER / MOTHER / GUARDIAN → 201');
  it.todo('TC-CHILD-04 liên kết phụ huynh trùng → 409');
  it.todo('TC-CHILD-05 trẻ đã có dữ liệu không bị xóa cứng, chỉ chuyển trạng thái');
  it.todo('TC-CHILD-06 phụ huynh xem hồ sơ con mình → 200');
  it.todo('TC-CHILD-07 phụ huynh A xem hồ sơ con của phụ huynh B → 403 (IDOR)');
  it.todo('TC-CHILD-08 GET /children có phân trang');
  it.todo('TC-REL-01 lỗi giữa chừng khi tạo trẻ + gắn phụ huynh → không còn dữ liệu dở dang');
});
