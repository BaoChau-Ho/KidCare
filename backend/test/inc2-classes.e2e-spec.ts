// Increment 2 — lớp học và phân công giáo viên (UC-05).
// Mã test case: docs/03-testing/Test_Cases.md. API: docs/02-design/openapi.yaml.
// Đang ở dạng it.todo vì module classes chưa được code. Khi API được merge vào main,
// thay it.todo bằng it(...) và dùng createTestApp() trong ./helpers/app.

describe('Inc 2 — Lớp học và phân công giáo viên (e2e)', () => {
  it.todo('TC-CLASS-01 tạo lớp hợp lệ → 201');
  it.todo('TC-CLASS-02 tạo lớp trùng tên trong cùng năm học → 409');
  it.todo('TC-CLASS-03 đóng lớp khi còn trẻ đang học → bị từ chối');
  it.todo('TC-CLASS-04 phân công giáo viên; phân công lại không tạo bản ghi trùng');
  it.todo('TC-CLASS-05 gỡ phân công giáo viên khỏi lớp');
  it.todo('TC-CLASS-06 xếp trẻ vào lớp');
  it.todo('TC-CLASS-07 giáo viên xem lớp được phân công → 200; lớp khác → 403');
});
