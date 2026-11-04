# UC-04 — Quản lý hồ sơ trẻ

| Thuộc tính | Nội dung |
|---|---|
| Mã | UC-04 |
| Tác nhân chính | Quản lý cơ sở |
| Mức quan trọng | Cao |
| Loại | Chi tiết, thiết yếu |
| Yêu cầu liên quan | FR-CHILD-01, FR-CHILD-02 |
| Trạng thái tài liệu | Chuyển từ `04_Dac_Ta_Use_Case.md`; chưa đồng nghĩa tính năng đã được code |

## Mục tiêu

Quản lý cơ sở quản lý hồ sơ trẻ, xếp trẻ vào lớp và liên kết tài khoản phụ huynh để các tính năng sau chỉ hiển thị dữ liệu đúng người.

## Các bên liên quan

- **Quản lý cơ sở:** cần hồ sơ trẻ đầy đủ và chính xác.
- **Phụ huynh:** cần thông tin con được lưu đúng và liên kết với tài khoản của mình.
- **Giáo viên:** cần biết chính xác trẻ thuộc lớp mình phụ trách.

## Tiền điều kiện

- Quản lý cơ sở đã đăng nhập và có quyền quản lý trẻ.
- Lớp được chọn đã tồn tại và đang hoạt động.
- Muốn liên kết phụ huynh thì tài khoản phụ huynh phải tồn tại hoặc được tạo theo quy trình được phép.

## Kích hoạt

Có trẻ mới nhập học, thông tin trẻ thay đổi hoặc trẻ nghỉ học.

## Luồng chính

1. Quản lý cơ sở mở chức năng **Quản lý trẻ**.
2. Hệ thống hiển thị danh sách có phân trang, tìm kiếm theo tên, lọc theo lớp và trạng thái.
3. Quản lý chọn thao tác:
   - Thêm trẻ: thực hiện S1.
   - Cập nhật thông tin: thực hiện S2.
   - Liên kết phụ huynh: thực hiện S3.
   - Xóa hoặc đổi trạng thái: thực hiện S4.
4. Hệ thống kiểm tra quyền, tính hợp lệ và các quan hệ liên quan.
5. Hệ thống lưu thay đổi và cập nhật danh sách.

## Luồng con

### S1 — Thêm trẻ

1. Quản lý nhập họ tên, ngày sinh, giới tính, địa chỉ, ảnh đại diện nếu có và lớp.
2. Hệ thống kiểm tra các trường bắt buộc, ngày sinh và lớp đang hoạt động.
3. Hệ thống tạo hồ sơ với trạng thái **Đang học**.

### S2 — Cập nhật hồ sơ hoặc chuyển lớp

1. Quản lý chọn trẻ.
2. Quản lý sửa thông tin hoặc chọn lớp mới.
3. Hệ thống xác nhận lớp mới hoạt động, lưu thay đổi và cập nhật hồ sơ.

### S3 — Liên kết phụ huynh

1. Quản lý tìm tài khoản phụ huynh theo email hoặc số điện thoại.
2. Quản lý chọn quan hệ `FATHER`, `MOTHER` hoặc `GUARDIAN`.
3. Hệ thống tạo liên kết trong `child_parents`.

### S4 — Xóa hoặc đổi trạng thái

1. Quản lý chọn trẻ và xác nhận thao tác.
2. Nếu trẻ chưa có dữ liệu nghiệp vụ, xử lý theo chính sách xóa đã thống nhất.
3. Nếu trẻ đã có dữ liệu điểm danh/sức khỏe, hệ thống không xóa cứng; chuyển trạng thái sang **Đã nghỉ học**.

## Luồng thay thế và lỗi

- **S1a — Thiếu họ tên/ngày sinh/giới tính:** báo lỗi tại trường tương ứng và yêu cầu nhập lại.
- **S1b — Lớp không tồn tại hoặc đã đóng:** từ chối tạo hồ sơ và yêu cầu chọn lớp khác.
- **S3a — Không tìm thấy phụ huynh:** thông báo; cho phép tạo tài khoản phụ huynh mới chỉ khi quy trình UC-02/UC-03 cho phép.
- **S3b — Phụ huynh đã liên kết với trẻ:** báo trùng và không tạo liên kết thứ hai.
- **S4a — Trẻ có dữ liệu điểm danh/sức khỏe:** từ chối xóa cứng, chuyển trạng thái sang đã nghỉ học.
- **E-AUTH — Không đủ quyền:** từ chối thao tác.
- **IDOR — Truy cập hồ sơ không thuộc phạm vi được phép:** không trả dữ liệu trẻ.
- **Lỗi khi tạo trẻ và liên kết phụ huynh cùng request:** rollback toàn bộ transaction, không để hồ sơ dở dang.

## Hậu điều kiện

- Hồ sơ trẻ được lưu với lớp và trạng thái hợp lệ.
- Quan hệ trẻ–phụ huynh được lưu không trùng.
- Lịch sử nghiệp vụ của trẻ được bảo toàn khi trẻ nghỉ học.

## Dữ liệu chính

- Trẻ: `id`, họ tên, ngày sinh, giới tính, địa chỉ, ảnh đại diện, lớp, trạng thái.
- Liên kết: `child_id`, `parent_user_id`, quan hệ.

## API dự kiến

- `GET /children?query=&classId=&status=&page=&limit=`
- `POST /children`
- `GET /children/:id`
- `PATCH /children/:id`
- `POST /children/:id/parents`

## Tiêu chí chấp nhận

- Quản lý tạo, xem, sửa, tìm kiếm và lọc hồ sơ trẻ.
- Quản lý xếp trẻ vào lớp đang hoạt động và chuyển lớp hợp lệ.
- Quản lý liên kết một hoặc nhiều phụ huynh; không tạo liên kết trùng.
- Trẻ đã có dữ liệu nghiệp vụ không bị xóa cứng.
- Các danh sách có phân trang.
- Transaction rollback khi tạo hồ sơ/liên kết gặp lỗi.
- Kiểm tra quyền sở hữu dữ liệu; phụ huynh không thể xem hồ sơ trẻ khác bằng cách đổi `id`.
