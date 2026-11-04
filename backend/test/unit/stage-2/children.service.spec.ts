// Giai đoạn 2 — UC-04 quản lý hồ sơ trẻ và liên kết phụ huynh.
// Danh sách test và tiến độ: backend/test/README.md.
// Chưa có ChildrenService nên đang ở dạng it.todo. Khi có code, thay bằng it(...).

describe('GĐ2 · ChildrenService', () => {
  it.todo('UT-CHILD-01 tạo trẻ hợp lệ → trạng thái mặc định đang học');
  it.todo('UT-CHILD-02 xếp vào lớp không tồn tại hoặc đã đóng → bị từ chối');
  it.todo(
    'UT-CHILD-03 liên kết phụ huynh với quan hệ FATHER / MOTHER / GUARDIAN',
  );
  it.todo('UT-CHILD-04 quan hệ không hợp lệ → 400');
  it.todo('UT-CHILD-05 liên kết người không có role phụ huynh → bị từ chối');
  it.todo('UT-CHILD-06 liên kết trùng → 409');
  it.todo(
    'UT-CHILD-07 tạo trẻ + liên kết phụ huynh lỗi giữa chừng → không có dữ liệu dở dang',
  );
  it.todo('UT-CHILD-08 ngừng theo học chỉ đổi trạng thái, không xóa');
  it.todo(
    'UT-CHILD-09 hàm kiểm tra quyền sở hữu: đúng phụ huynh → true, phụ huynh khác → false',
  );
  it.todo(
    'UT-CHILD-10 danh sách trẻ có phân trang, lọc theo lớp và trạng thái',
  );
});
