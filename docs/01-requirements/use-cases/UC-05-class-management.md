# UC-05 — Quản lý lớp học và phân công giáo viên

| Thuộc tính | Nội dung |
|---|---|
| Mã | UC-05 |
| Tác nhân chính | Quản lý cơ sở |
| Mức quan trọng | Cao |
| Loại | Chi tiết, thiết yếu |
| Yêu cầu liên quan | FR-CLASS-01 đến FR-CLASS-04 |
| Trạng thái tài liệu | Chuyển từ `04_Dac_Ta_Use_Case.md`; chưa đồng nghĩa tính năng đã được code |

## Mục tiêu

Quản lý cơ sở tổ chức lớp theo năm học và phân công một hoặc nhiều giáo viên cho từng lớp.

## Các bên liên quan

- **Quản lý cơ sở:** cần tổ chức lớp và nhân sự hợp lý.
- **Giáo viên:** cần biết rõ lớp mình phụ trách.
- **Phụ huynh:** cần biết giáo viên phụ trách lớp của trẻ.

## Tiền điều kiện

- Quản lý cơ sở đã đăng nhập và có quyền quản lý lớp.
- Giáo viên được phân công tồn tại, đang hoạt động và có role `TEACHER`.

## Kích hoạt

Bắt đầu năm học mới, mở lớp mới hoặc thay đổi nhân sự.

## Luồng chính

1. Quản lý cơ sở mở chức năng **Quản lý lớp**.
2. Hệ thống hiển thị danh sách lớp theo năm học.
3. Quản lý chọn thao tác:
   - Thêm lớp: thực hiện S1.
   - Sửa hoặc đóng lớp: thực hiện S2.
   - Phân công giáo viên: thực hiện S3.
4. Hệ thống kiểm tra dữ liệu và các quan hệ với trẻ/giáo viên.
5. Hệ thống lưu thay đổi và cập nhật danh sách.

## Luồng con

### S1 — Thêm lớp

1. Quản lý nhập tên lớp và năm học.
2. Hệ thống kiểm tra không có lớp cùng tên trong cùng năm học.
3. Hệ thống tạo lớp với trạng thái **Hoạt động**.

### S2 — Sửa hoặc đóng lớp

1. Quản lý chọn lớp và sửa thông tin hoặc yêu cầu đóng lớp.
2. Nếu đóng lớp, hệ thống kiểm tra lớp không còn trẻ đang học.
3. Hệ thống lưu thay đổi hoặc chuyển trạng thái sang **Đã đóng**.

### S3 — Phân công giáo viên

1. Quản lý chọn lớp.
2. Hệ thống hiển thị danh sách giáo viên đang hoạt động.
3. Quản lý chọn một hoặc nhiều giáo viên để phân công, hoặc gỡ một phân công.
4. Hệ thống kiểm tra phân công chưa tồn tại rồi lưu thay đổi.

## Luồng thay thế và lỗi

- **S1a — Tên lớp đã tồn tại trong cùng năm học:** báo lỗi và yêu cầu tên khác.
- **S2a — Đóng lớp còn trẻ đang học:** cảnh báo, yêu cầu chuyển trẻ sang lớp khác trước.
- **S3a — Giáo viên đã được phân công:** báo trùng, không tạo phân công thứ hai.
- **S3b — User không phải giáo viên hoặc đã bị khóa:** từ chối phân công.
- **E-AUTH — Không đủ quyền:** từ chối thao tác.
- **Lỗi lưu database:** không để trạng thái lớp/phân công cập nhật một phần.

## Hậu điều kiện

- Lớp có tên, năm học và trạng thái hợp lệ.
- Quan hệ lớp–giáo viên phản ánh đúng danh sách phân công hiện tại.
- Lớp đã đóng không nhận thêm trẻ hoặc phân công mới.

## Dữ liệu chính

- Lớp: `id`, tên, năm học, trạng thái.
- Phân công: `class_id`, `teacher_user_id`, thời điểm phân công.
- MVP một cơ sở có thể chưa cần `school_id`; nếu hỗ trợ nhiều cơ sở, thêm trường này và đưa vào ràng buộc duy nhất.

## API dự kiến

- `GET /classes?academicYear=&status=&page=&limit=`
- `POST /classes`
- `GET /classes/:id`
- `PATCH /classes/:id`
- `POST /classes/:id/teachers`
- `DELETE /classes/:id/teachers/:teacherId`

## Tiêu chí chấp nhận

- Quản lý tạo, xem, sửa và đóng lớp.
- Không thể tạo hai lớp trùng tên trong cùng năm học.
- Có thể phân công/gỡ nhiều giáo viên cho một lớp.
- Phân công trùng bị từ chối; chỉ user role `TEACHER` đang hoạt động được phân công.
- Không thể đóng lớp khi còn trẻ đang học.
- Giáo viên chỉ truy cập lớp được phân công sau khi guard và kiểm tra phạm vi được triển khai.
- Danh sách lớp có phân trang và lọc theo năm học/trạng thái.
