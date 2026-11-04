# Stage 2 — UC-03, UC-04 và UC-05

Tài liệu này đưa ba use case trong `04_Dac_Ta_Use_Case.md` vào Stage 2 / Increment 2 của kế hoạch KidCare.

## Phạm vi và thứ tự

Stage 2 gồm:

1. **UC-03 — Quản lý tài khoản người dùng (Admin):** tạo, xem danh sách, sửa thông tin, gán role, khóa/mở khóa và ghi audit log.
2. **UC-05 — Quản lý lớp và phân công giáo viên (Quản lý cơ sở):** tạo/sửa/đóng lớp, phân công hoặc gỡ giáo viên.
3. **UC-04 — Quản lý hồ sơ trẻ (Quản lý cơ sở):** tạo/sửa/xem hồ sơ, xếp lớp và liên kết tài khoản phụ huynh.

Làm theo thứ tự trên vì UC-04 cần lớp để xếp trẻ, và cần tài khoản phụ huynh để tạo quan hệ trẻ–phụ huynh. UC-03 vốn phụ thuộc xác thực của Increment 1; trong Stage 2 chỉ làm phần **Admin quản lý tài khoản**, không làm lại đăng nhập/đăng ký. Nếu chưa có login/guard, dùng seed account dành riêng cho development và hoàn thiện guard trước khi mở các API quản trị.

## Tình trạng nền hiện tại

- `backend/src/users/user.entity.ts` mới có `email`, `password_hash`, `created_at`, `id`.
- `backend/src/users/users.module.ts` mới đăng ký repository; chưa có controller/service.
- `backend/src/auth/auth.module.ts` đang rỗng.
- Chưa có module `children`, `classes`, `parents` hoặc `audit-logs`.
- Migration `Schema` hiện tạo bảng `users` với email, password hash và thời điểm tạo.

Do đó, mỗi thay đổi schema bên dưới phải được thêm vào **migration mới**. Không sửa migration đã chạy trên database dùng chung.

## Bước 1 — Chốt thiết kế trước khi code

Tạo/cập nhật các tài liệu:

- [UC-03 — Quản lý tài khoản](../01-requirements/use-cases/UC-03-user-management.md)
- [UC-04 — Quản lý hồ sơ trẻ](../01-requirements/use-cases/UC-04-child-management.md)
- [UC-05 — Quản lý lớp và phân công giáo viên](../01-requirements/use-cases/UC-05-class-management.md)
- `docs/01-requirements/traceability.csv`
- `docs/02-design/erd.md`
- `docs/02-design/openapi.yaml`

Chốt các điểm sau với nhóm:

- Role cố định: `ADMIN`, `MANAGER`, `TEACHER`, `MEDICAL_STAFF`, `PARENT`.
- Trạng thái user: tối thiểu `ACTIVE` và `LOCKED`. Không cho API đăng ký công khai tự chọn role.
- Đóng tài khoản/lớp/trẻ theo kiểu **soft delete** (đổi trạng thái), để không làm mất lịch sử điểm danh/sức khỏe. Nếu môn học yêu cầu xóa vật lý, cần thống nhất quy tắc bảo toàn các quan hệ trước.
- MVP chỉ có một cơ sở: có thể bỏ `school_id`; nếu hệ thống cần nhiều cơ sở thì thêm khóa này vào thiết kế ngay.
- Mỗi lớp có nhiều giáo viên; một giáo viên có thể phụ trách nhiều lớp. Dùng bảng nối `class_teachers`.
- Một trẻ có thể có nhiều phụ huynh và ngược lại. Dùng bảng nối `child_parents` với `relationship`.
- Với MVP, `child_parents.parent_user_id` có thể tham chiếu `users.id` có role `PARENT`; chỉ tạo bảng `parents` riêng nếu có thông tin phụ huynh ngoài tài khoản đăng nhập.

## Bước 2 — Database và migration

### User và audit log — UC-03

Mở rộng `backend/src/users/user.entity.ts` với `name`, `role`, `status` và các trường liên hệ được nhóm thống nhất. Email phải unique. Tạo entity `AuditLog` trong `backend/src/audit-logs/audit-log.entity.ts` để ghi actor, action, resource type/id và thời gian; không ghi password, token hoặc dữ liệu nhạy cảm.

### Class — UC-05

Tạo:

- `backend/src/classes/class.entity.ts`: tên lớp, năm học, trạng thái.
- `backend/src/classes/class-teacher.entity.ts`: khóa ngoại class/user và thời điểm phân công.

Ràng buộc nên có: tên lớp không trùng trong cùng năm học; cặp `(class_id, teacher_id)` không trùng.

### Child — UC-04

Tạo:

- `backend/src/children/child.entity.ts`: tên, ngày sinh, giới tính, địa chỉ, avatar metadata, class, trạng thái.
- `backend/src/children/child-parent.entity.ts`: child, user phụ huynh và quan hệ `FATHER` / `MOTHER` / `GUARDIAN`.

Tạo trẻ và liên kết phụ huynh trong một transaction nếu hai thao tác được gửi cùng request. Migration phải tạo foreign key, unique constraints và index phục vụ tìm kiếm/lọc cần thiết.

Sau khi entity đã thống nhất:

```powershell
docker compose up -d db
cd backend
npm run migration:generate
# Mở migration vừa tạo, kiểm tra SQL và thứ tự ràng buộc
npm run migration:run
```

Nếu migration phát sinh gộp nhiều bảng, có thể giữ chung nếu thứ tự tạo foreign key rõ ràng; nếu khó review, tách thành migration nhỏ theo users/audit, classes, children.

## Bước 3 — Backend theo module

Mỗi module đi theo mẫu `entity → DTO → service → controller → module`:

```text
backend/src/users/
  users.module.ts
  users.controller.ts
  users.service.ts
  user.entity.ts
  dto/
    create-user.dto.ts
    update-user.dto.ts
backend/src/audit-logs/
backend/src/classes/
  class.entity.ts
  class-teacher.entity.ts
  classes.module.ts
  classes.controller.ts
  classes.service.ts
  dto/
    create-class.dto.ts
backend/src/children/
  child.entity.ts
  child-parent.entity.ts
  children.module.ts
  children.controller.ts
  children.service.ts
  dto/
    create-child.dto.ts
```

### API đề xuất

UC-03, chỉ Admin:

- `GET /users?query=&role=&status=&page=&limit=` — danh sách có lọc và phân trang.
- `POST /users` — tạo tài khoản do Admin cấp; hash mật khẩu tạm thời, không trả hash.
- `PATCH /users/:id` — sửa thông tin được phép.
- `PATCH /users/:id/role` — đổi role.
- `PATCH /users/:id/status` — khóa/mở khóa; không cho Admin tự khóa tài khoản của mình.
- Ghi audit log cho tạo, sửa, đổi role, khóa/mở khóa.

UC-05, Quản lý cơ sở:

- `GET /classes?academicYear=&status=&page=&limit=` và `POST /classes`.
- `GET /classes/:id`, `PATCH /classes/:id`.
- `POST /classes/:id/teachers` để phân công; `DELETE /classes/:id/teachers/:teacherId` để gỡ phân công.
- Không đóng lớp khi còn trẻ đang học; báo lỗi và yêu cầu chuyển trẻ trước.

UC-04, Quản lý cơ sở:

- `GET /children?query=&classId=&status=&page=&limit=` và `POST /children`.
- `GET /children/:id`, `PATCH /children/:id`.
- `POST /children/:id/parents` để liên kết phụ huynh.
- Kiểm tra email/điện thoại phụ huynh; không tạo liên kết trùng.
- Không xóa cứng trẻ đã có dữ liệu nghiệp vụ; chuyển trạng thái sang `INACTIVE`/`WITHDRAWN`.

Controller chỉ nhận/trả HTTP; DTO kiểm tra dữ liệu; service chứa quy tắc nghiệp vụ; repository truy cập database. Dùng Guard để yêu cầu login và role. Kiểm tra quyền sở hữu/lớp ở service/API, không chỉ ẩn nút trên giao diện.

## Bước 4 — Frontend

Tạo API client và trang theo vai trò:

```text
frontend/src/api/users.ts
frontend/src/api/classes.ts
frontend/src/api/children.ts
frontend/src/pages/admin/UsersPage.tsx
frontend/src/pages/classes/ClassesPage.tsx
frontend/src/pages/children/ChildrenPage.tsx
frontend/src/pages/children/ChildDetailPage.tsx
frontend/src/components/   # bảng, form, phân trang dùng lại
```

Luồng demo tối thiểu:

1. Admin tạo tài khoản Giáo viên và Phụ huynh.
2. Quản lý tạo lớp, phân công giáo viên.
3. Quản lý tạo hồ sơ trẻ, xếp lớp và liên kết phụ huynh.
4. Giáo viên chỉ xem được lớp được phân công; phụ huynh chỉ xem trẻ đã liên kết.

## Bước 5 — Test và Definition of Done

Backend unit tests đặt cạnh service (`*.spec.ts`); API/e2e tests trong `backend/test/`. Frontend tests đặt cạnh component/page (`*.test.tsx`). Bắt buộc kiểm tra:

- User email trùng bị từ chối; Admin không thể tự khóa/xóa chính mình.
- User không phải Admin gọi API UC-03 nhận `403`; chưa login nhận `401`.
- Lớp trùng tên/năm học và phân công giáo viên trùng bị từ chối.
- Không đóng lớp còn trẻ đang học.
- Tạo trẻ + liên kết phụ huynh lỗi giữa chừng thì transaction rollback.
- Phụ huynh A không xem/sửa trẻ của phụ huynh B (test IDOR); giáo viên khác lớp không truy cập được lớp.
- Danh sách có phân trang; response không chứa `password_hash`.
- Test regression của Increment 1 vẫn xanh.

Chạy từ backend:

```powershell
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
```

Stage 2 chỉ hoàn thành khi migration đã review/apply, ba use case chạy qua UI/API, quyền và test IDOR đạt, dữ liệu mẫu demo được nạp bằng một lệnh, OpenAPI và traceability khớp code, CI xanh, PR đã được review và nhóm demo/retrospective.
