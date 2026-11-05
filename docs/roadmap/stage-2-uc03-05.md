# Stage 2 — Quản lý người dùng, lớp và hồ sơ trẻ (UC-03–05)

Stage 2 mở rộng nền xác thực hiện có. Không xây lại login/registration; ưu tiên UC-03, rồi UC-05, sau đó UC-04 vì hồ sơ trẻ cần lớp và tài khoản phụ huynh.

## Tình trạng hiện tại trong repo

### Đã có

- `backend/src/users/user.entity.ts`: `id` UUID, `email`, `passwordHash`, `fullName`, `role`, `status`, `phone`, `nationalId`, `createdAt`.
- `UsersController`/`UsersService`: API liệt kê, tạo, cập nhật user, đổi role/status; kiểm tra quyền Admin/Manager và ghi audit log cùng transaction.
- `AuditLog` entity/module/API: Admin có thể lọc nhật ký theo khoảng ngày và các trường hỗ trợ.
- `ClassesController`/`ClassesService`: API lớp học và phân công giáo viên đã được thêm; migration `1793810000004-AddClasses.ts` cần được xem lại và chạy trên database.
- `ChildrenController`/`ChildrenService`: API hồ sơ trẻ, lọc/phân trang, đổi lớp/trạng thái và liên kết phụ huynh đã được thêm; migration `1793810000005-AddChildren.ts` cần được xem lại và chạy trên database.
- Migration user profile và `1793810000000-ChangeUserIdToUuid.ts` đã có. Việc migration đã chạy trên database nào cần kiểm tra bằng TypeORM; không suy ra từ việc file tồn tại.
- Auth login/JWT guard/AdminGuard và seed admin đã có. JWT guard hiện yêu cầu `sub` là UUID.
- `UsersModule`, `ClassesModule` và `ChildrenModule` đăng ký repository và được import trong `AppModule`.

### Chưa có

- Frontend đang dùng mock cho các màn hình quản trị; chưa tích hợp đầy đủ các API Stage 2 với backend.
- Kiểm thử API/phân quyền UC-03–05 qua database và hoàn thiện tích hợp frontend.

## Quy ước ID đã chốt

Dùng UUID cho ID tài nguyên và khóa ngoại mới. `User.id` đã đổi sang UUID trong entity/JWT guard và có migration chuyển kiểu. Migration hiện cấp UUID mới cho từng user, nên ID cũ sẽ đổi; JWT cũ chứa số nguyên không còn hợp lệ sau khi code UUID được chạy.

Trước khi chạy migration trên database có dữ liệu:

1. Kiểm tra `migration:show` để biết migration đã áp dụng chưa.
2. Backup DB và xác nhận có FK/tables bên ngoài tham chiếu `users.id` không.
3. Lưu ý migration hiện tại không giữ mapping id số cũ → UUID; `down` tạo ID số mới chứ không khôi phục ID ban đầu. Không coi rollback là khôi phục nguyên trạng.
4. `RegistrationRequest.id` hiện vẫn SERIAL và controller dùng `ParseIntPipe`, trong khi OpenAPI mô tả UUID. Chuyển nó sang UUID trong migration riêng hoặc ghi rõ ngoại lệ trước khi client phụ thuộc vào ID này.
5. Tạo PK/FK mới với kiểu UUID đồng nhất cho AuditLog, Class, Child và các bảng nối.

## Quy ước role/status hiện tại

Backend dùng role chữ hoa `ADMIN`, `MANAGER`, `TEACHER`, `MEDICAL_STAFF`, `PARENT`; status user `ACTIVE`, `LOCKED`, `INACTIVE`. Migration `1793810000002-UseUppercaseRoleAndStatus.ts` chuyển dữ liệu hiện có; xác nhận migration đã chạy trên đúng database trước khi dùng API.

`fullName` vẫn nullable trong entity/DB; DTO tạo user nên bắt buộc. Chỉ chuyển cột thành NOT NULL sau khi backfill dữ liệu cũ.

## Phạm vi và thứ tự triển khai

1. **UC-03:** Backend API user, phân quyền, audit log và Manager lookup đã có; cần hoàn tất tích hợp frontend và xác minh contract/API trên database.
2. **UC-05:** Backend API lớp và phân công giáo viên đã có; cần chạy migration, bổ sung kiểm tra đóng lớp dựa trên trẻ ACTIVE sau UC-04, rồi nối frontend.
3. **UC-04:** backend API hồ sơ trẻ, xếp lớp và liên kết phụ huynh đã có; cần chạy migration và kiểm tra nghiệp vụ trên database.

## Bước 1 — UC-03 quản lý user

Trong `backend/src/users/`, tạo `users.controller.ts`, `users.service.ts` và DTO cho tạo user, sửa hồ sơ, đổi role, đổi status. `main.ts` đã bật `ValidationPipe` với whitelist/forbidNonWhitelisted.

- `GET /users`: Admin xem/lọc/phân trang. Manager chỉ lookup `active` user có role `teacher` hoặc `parent`, phải cung cấp role filter; Manager không được quản trị tài khoản.
- `POST /users`: chỉ Admin; normalize email, kiểm tra trùng, hash mật khẩu tạm bằng Argon2, response không có hash/CCCD.
- `PATCH /users/:id`: sửa trường hồ sơ được phép.
- `PATCH /users/:id/role`: chỉ Admin, validate enum.
- `PATCH /users/:id/status`: chỉ Admin, dùng `active`/`disabled`; chặn tự khóa.

Parse path IDs như UUID (`ParseUUIDPipe` trong NestJS). Gắn `JwtAuthGuard` cho route cần login; gắn `AdminGuard` thêm ở route quản trị. Hiện `AuthModule` chưa export hai guard, nên export chúng hoặc đăng ký provider phù hợp ở `UsersModule`. `AdminGuard` yêu cầu request đã qua `JwtAuthGuard` trước.

### Audit log

Tạo `backend/src/audit-logs/audit-log.entity.ts`, service/module và `GET /audit-logs` chỉ dành cho Admin. `id` và `actorUserId` là UUID; `resourceId` có thể là UUID/string tùy resource. Ghi actor, action, resource type/id, before/after đã lọc và thời gian. Không lưu password, token, `nationalId` hoặc bí mật khác. Nên ghi mutation và audit trong cùng transaction.

## Bước 2 — UC-05 lớp và giáo viên

Tạo `backend/src/classes/` với `Classroom`, `ClassTeacher`, DTO/service/controller/module. Dùng UUID cho PK/FK; unique `(class_id, teacher_user_id)` và tên lớp/năm học. Chỉ gán user active có role `teacher`; không đóng lớp còn trẻ active. API theo OpenAPI: `/classes`, `/classes/:id`, `/classes/:id/teachers`.

## Bước 3 — UC-04 hồ sơ trẻ

Tạo `backend/src/children/` với `Child`, `ChildParent`, DTO/service/controller/module. PK/FK là UUID. Tạo và liên kết phụ huynh trong transaction nếu cùng request. Trẻ đã có dữ liệu nghiệp vụ được chuyển trạng thái thay vì xóa cứng. API theo OpenAPI: `/children`, `/children/:id`, `/children/:id/parents`.

## Database và migration

User profile đã có entity/migration; không tạo migration lặp lại. Trước mọi migration, kiểm tra trạng/status database:

```powershell
cd backend
npx typeorm-ts-node-commonjs -d src/database/data-source.ts migration:show
```

Sau khi thêm AuditLog/Class/Child entities, xác nhận DataSource glob nhận entity mới, rồi:

```powershell
npm run migration:generate
# Xem SQL, kiểu UUID của PK/FK, unique/index, backfill và dữ liệu cũ
npm run migration:run
```

Không sửa migration đã áp dụng. Không chạy lại `ChangeUserIdToUuid` nếu TypeORM đã đánh dấu nó đã chạy. Trên DB dùng chung, backup và rà FK trước khi đổi PK.

## Frontend

Tạo `frontend/src/api/users.*`, trang admin user và form/list có phân trang. Client coi ID là chuỗi UUID; không parse ID sang number. Sau đó mới làm client/màn hình lớp và trẻ. Ẩn nút theo role chỉ phục vụ UX; backend vẫn phải kiểm tra quyền.

## Kiểm tra và điều kiện hoàn tất UC-03

- Email trùng bị từ chối; Manager lookup chỉ trả teacher/parent active; Manager không gọi được mutation.
- Thiếu JWT trả 401; role không đủ trả 403; UUID sai định dạng trả 400.
- Admin không tự khóa; user disabled không đăng nhập/không dùng JWT.
- Response không chứa password hash/CCCD; mutation có audit đã lọc.
- IDs/FKs/OpenAPI/JWT đều dùng UUID; role/status casing khớp code.
- CI hiện gọi backend test scripts chưa khai báo; thêm scripts/tests hoặc sửa workflow trước khi coi CI là xanh.

Stage 2 hoàn tất khi UC-03/05/04 chạy qua API/UI, migration đã được review và áp dụng, phân quyền/IDOR được kiểm tra, OpenAPI khớp code và CI xanh.
