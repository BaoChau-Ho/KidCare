// Giai đoạn 2 — UC-05 quản lý lớp và phân công giáo viên.
// Danh sách test và tiến độ: backend/test/README.md.
// Chưa có ClassesService nên đang ở dạng it.todo. Khi có code, thay bằng it(...).

describe('GĐ2 · ClassesService', () => {
  it.todo('UT-CLASS-01 tạo lớp hợp lệ → trạng thái hoạt động');
  it.todo('UT-CLASS-02 trùng tên trong cùng năm học → 409');
  it.todo('UT-CLASS-03 trùng tên nhưng khác năm học → hợp lệ');
  it.todo('UT-CLASS-04 đóng lớp còn trẻ đang học → bị từ chối, không lưu');
  it.todo('UT-CLASS-05 đóng lớp không còn trẻ → thành công');
  it.todo('UT-CLASS-06 phân công người không phải giáo viên → bị từ chối');
  it.todo(
    'UT-CLASS-07 phân công giáo viên đã có trong lớp → không tạo bản ghi trùng',
  );
  it.todo('UT-CLASS-08 gỡ giáo viên không có trong lớp → 404');
  it.todo('UT-CLASS-09 danh sách lớp có phân trang và lọc theo năm học');
});
