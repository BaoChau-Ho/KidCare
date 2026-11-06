# Tiến độ kiểm thử backend — KidCare

Cập nhật lần cuối: **06/11/2026**, trên `main` tại commit `a3eba22`.

## Tổng quan

| Giai đoạn | Phạm vi | Đạt | Todo | Lỗi | Tình trạng |
|---|---|---|---|---|---|
| 0 | Hạ tầng: health check | 3 | 0 | 0 | ✅ Xong |
| 1 | Đăng nhập, đăng ký, duyệt đăng ký (UC-01, UC-02) | 118 | 4 | 0 | 🟡 Còn `RolesGuard` chưa có code |
| 2 | Tài khoản, lớp, hồ sơ trẻ (UC-03, UC-04, UC-05) | 88 | 0 | 0 | ✅ Unit xong |
| | **Tổng unit** | **209** | **4** | **0** | |

| E2E (API thật + PostgreSQL thật) | File | Đạt | Trong đó lỗi đã biết |
|---|---|---|---|
| 0 · Health, migration | `e2e/stage-0-infra.e2e-spec.ts` | 6 | 1 (#14) |
| 1 · Đăng nhập, token | `e2e/stage-1-auth.e2e-spec.ts` | 21 | 2 (#5, #15) |
| 1 · Đăng ký, duyệt | `e2e/stage-1-registration.e2e-spec.ts` | 14 | 0 |
| 2 · Phân quyền, IDOR | `e2e/stage-2-access.e2e-spec.ts` | 80 | 0 |
| 2 · Quản lý tài khoản, lớp, trẻ | `e2e/stage-2-management.e2e-spec.ts` | 21 | 3 (#9, #16, #17) |
| **Tổng e2e** | | **142** | **6** |

- **Đạt:** test đã chạy và qua.
- **Todo:** test đã đặt tên (`it.todo`) nhưng chưa viết phần thân, vì code tương ứng chưa có. Todo không làm CI đỏ.
- **Lỗi đã biết:** test viết bằng `it.failing` mô tả hành vi đúng nhưng code hiện còn sai; test này "đạt" khi lỗi còn tồn tại. Sửa xong lỗi thì đổi `it.failing` thành `it`. Hiện có 1 unit test (UT-CHILD-08d) và 6 e2e test.
- Số test lớn hơn số mã `UT-` vì mỗi `it.each` được tính thành nhiều test.

## Cấu trúc thư mục

```
backend/test/
├── README.md               file này
├── jest-e2e.json           cấu hình e2e test
├── e2e/
│   ├── setup-env.ts        đặt JWT_SECRET mặc định trước khi nạp AppModule
│   ├── helpers/app.ts      dựng app NestJS trên database tạm, tạo tài khoản + token
│   └── stage-<số>-*.e2e-spec.ts
├── helpers/
│   └── mocks.ts            đồ giả dùng chung: repository, QueryBuilder, DataSource, ExecutionContext, kiểm tra DTO
└── unit/
    ├── stage-0/            giai đoạn 0 — hạ tầng
    ├── stage-1/            giai đoạn 1 — đăng nhập, đăng ký
    └── stage-2/            giai đoạn 2 — tài khoản, lớp, hồ sơ trẻ
```

- Unit test: `test/unit/stage-<số>/<tên>.spec.ts`. Kiểm tra một class, mọi phụ thuộc (repository, `DataSource`, `JwtService`, `argon2`) đều được giả lập. Không cần database.
- Tên nhóm test bắt đầu bằng `GĐ<số> ·`, tên test bắt đầu bằng mã `UT-...`, ví dụ `GĐ1 · AuthService › login › UT-LOGIN-02 sai mật khẩu → 401 INVALID_CREDENTIALS`.
- E2E test: `test/e2e/stage-<số>-<phạm vi>.e2e-spec.ts`, mã `E2E-...`. Gọi HTTP vào app NestJS thật (Supertest) với PostgreSQL thật. Mỗi file tự tạo một database tạm tên `kidcare_e2e_...`, chạy đủ migration, xong thì xóa; không đụng vào database dev.
- `E2E-SEC-01` tự lấy danh sách endpoint từ tài liệu Swagger. API mới thêm vào sẽ tự được kiểm tra "thiếu token → 401"; API công khai mới phải được thêm vào `PUBLIC_ROUTES` trong `stage-2-access.e2e-spec.ts`.

## Cách chạy

```bash
cd backend
npm test                                  # toàn bộ unit test
npm test -- test/unit/stage-1             # chỉ một giai đoạn
npm test -- -t "UT-LOGIN"                 # chỉ các test có mã UT-LOGIN
npm run test:cov                          # kèm báo cáo độ phủ code
npm run lint
```

E2E test cần PostgreSQL đang chạy. `docker-compose.yml` map PostgreSQL ra cổng **5433**, nên trên máy dev phải đặt `DB_PORT=5433`; nếu không, test sẽ nối vào cổng 5432, có thể là Postgres của dự án khác. CI dùng service postgres ở cổng 5432 nên không cần đặt.

```bash
docker compose up -d db                   # ở thư mục gốc repo
cd backend
DB_PORT=5433 npm run test:e2e -- --runInBand                     # bash / Git Bash
$env:DB_PORT=5433; npm run test:e2e -- --runInBand               # PowerShell
DB_PORT=5433 npm run test:e2e -- --runInBand -t "E2E-IDOR"       # chỉ test IDOR
```

## Chi tiết theo file

### Giai đoạn 0 — `unit/stage-0/`

| File | Class được test | Mã test | Đạt | Todo |
|---|---|---|---|---|
| `health.controller.spec.ts` | `HealthController` | UT-HEALTH-01 → 03 | 3 | 0 |

Kiểm tra: `/health` trả "ok" và thời gian; database chạy trả "ok"; database lỗi trả 503 và không lộ nội dung lỗi.

### Giai đoạn 1 — `unit/stage-1/`

| File | Class được test | Mã test | Đạt | Todo |
|---|---|---|---|---|
| `auth-dto.spec.ts` | `LoginDto`, `SetPasswordDto` | UT-DTO-LOGIN-01 → 04, UT-DTO-PWD-01 → 06 | 15 | 0 |
| `auth.service.spec.ts` | `AuthService` | UT-LOGIN-01 → 09, UT-SETUP-01 → 06, UT-SETPWD-01 → 05 | 20 | 0 |
| `jwt-auth.guard.spec.ts` | `JwtAuthGuard` | UT-JWT-01 → 09 | 13 | 0 |
| `admin.guard.spec.ts` | `AdminGuard` | UT-ADMIN-01 → 03 | 6 | 0 |
| `registration-dto.spec.ts` | `CreateRegistrationRequestDto`, `RejectRegistrationRequestDto` | UT-DTO-REG-01 → 12, UT-DTO-REJ-01 → 02 | 39 | 0 |
| `registration-requests.service.spec.ts` | `RegistrationRequestsService` | UT-REG-01 → 10, UT-APPROVE-01 → 05, UT-REJECT-01 → 05, UT-LIST-01 → 02 | 25 | 0 |
| `roles.guard.spec.ts` | `RolesGuard` (chưa có code) | UT-ROLES-01 → 04 | 0 | 4 |

Kiểm tra:

- **Mã hóa mật khẩu:** mật khẩu được băm trước khi lưu; không bản ghi hay response nào chứa mật khẩu gốc.
- **Kiểm tra token:** thiếu token, sai scheme, token sai / hết hạn, `sub` không phải UUID, tài khoản không còn active đều bị 401. Token hợp lệ thì `request.user` không chứa mật khẩu.
- **Đăng nhập:** sai email và sai mật khẩu trả cùng một thông báo; tài khoản chờ duyệt / bị khóa không đăng nhập được; email được trim và chuyển chữ thường.
- **Đăng ký → duyệt / từ chối:** email hoặc CCCD trùng bị từ chối; chỉ duyệt / từ chối được yêu cầu đang chờ; từ chối thì xóa tài khoản đang chờ; có khóa dòng khi duyệt.
- **Phân quyền:** người không phải admin gọi API duyệt đăng ký nhận 403.
- **Dữ liệu vào:** giá trị biên của mật khẩu (7 / 8 / 128 / 129 ký tự), số điện thoại, CCCD, họ tên, email; không tự đăng ký được vai trò admin.

### Giai đoạn 2 — `unit/stage-2/`

| File | Class được test | Mã test | Đạt | Todo |
|---|---|---|---|---|
| `users.service.spec.ts` | `UsersService` (UC-03) | UT-USER-01 → 11 | 28 | 0 |
| `classes.service.spec.ts` | `ClassesService` (UC-05) | UT-CLASS-01 → 09 | 24 | 0 |
| `children.service.spec.ts` | `ChildrenService` (UC-04) | UT-CHILD-01 → 10 | 36 | 0 |

Kiểm tra:

- **Quyền sở hữu:** đúng phụ huynh của trẻ thì xem được, phụ huynh khác nhận 403; giáo viên chỉ xem trẻ và lớp được phân công; danh sách trẻ / lớp lọc theo phạm vi của người gọi (UT-CHILD-09, 10, UT-CLASS-09).
- **Tài khoản:** email trùng bị từ chối (kể cả khi hai request chạy song song); admin không tự khóa được chính mình; quản lý chỉ tra cứu được giáo viên / phụ huynh đang hoạt động; danh sách không trả `passwordHash`, CCCD.
- **Audit log:** mọi thao tác ghi đúng người làm, hành động, giá trị cũ / mới, IP; không chứa mật khẩu, hash, token, CCCD (UT-USER-11).
- **Lớp học:** trùng tên trong cùng năm học bị từ chối, ràng buộc duy nhất gồm cả tên và năm học; không đóng lớp còn trẻ; không phân công trùng, không phân công người không phải giáo viên, không phân công vào lớp đã đóng.
- **Hồ sơ trẻ:** ngày sinh không tồn tại / trong tương lai bị từ chối; không xếp vào lớp đã đóng; ngừng theo học chỉ đổi trạng thái, không xóa.
- **Transaction (UT-CHILD-07):** unit test chỉ kiểm tra được lỗi giữa chừng có được ném ra khỏi transaction hay không. Việc database thật sự rollback cần e2e với PostgreSQL.
- **Phân trang:** offset và tổng số trang tính đúng; `limit` > 100 hoặc `page` < 1 bị từ chối (400), không tự giới hạn (vấn đề #12).

Phần cần làm khi có API giai đoạn 2:

- [x] Test IDOR (e2e): phụ huynh A gọi API xem con của phụ huynh B phải nhận 403; giáo viên lớp khác không xem được lớp (E2E-IDOR-01 → 07).
- [x] Test E2E: Quản lý tạo lớp → tạo trẻ → gắn phụ huynh → phụ huynh đăng nhập thấy con (E2E-FLOW-01).
- [x] Chạy lại toàn bộ test giai đoạn 0–1 (regression): 121 unit + 41 e2e giai đoạn 0–1 đạt ngày 06/11/2026.

### E2E — `e2e/`

Kiểm tra:

- **Mặc định từ chối (E2E-SEC-01):** mọi API ngoài 6 API công khai trả 401 khi không có token.
- **Ma trận vai trò (E2E-SEC-02, 03):** 5 vai trò × 6 API đọc và 10 API ghi. Vai trò không được phép nhận 403 và database không thay đổi (so số bản ghi, vai trò, trạng thái trước / sau).
- **IDOR (E2E-IDOR):** phụ huynh A / B, giáo viên lớp A / B không thấy dữ liệu của nhau, kể cả khi lọc theo lớp của người khác; gỡ phân công, đổi vai trò hay khóa tài khoản thì mất quyền ngay với token cũ.
- **Token (E2E-AUTH-10 → 14):** thiếu, rác, ký sai secret, hết hạn, `sub` không phải UUID, tài khoản bị khóa / bị xóa đều 401.
- **Ghi đồng thời:** 2 request đăng ký cùng email, 2 request gắn cùng phụ huynh, 2 request phân công cùng giáo viên → đúng 1 bản ghi.
- **Transaction thật (E2E-CHILD-03):** dùng trigger trong database tạm làm hỏng việc ghi audit log; hồ sơ trẻ phải được rollback, response 500 không lộ lỗi nội bộ.
- **Migration (E2E-MIG):** chạy trên database trắng, so entity với schema, revert hết rồi chạy lại.

## Vấn đề phát hiện khi viết test

| # | Vấn đề | Vị trí | Mức độ | Trạng thái |
|---|---|---|---|---|
| 1 | `package.json` thiếu script `test`, `test:e2e`, nên CI lỗi | `backend/package.json` | Major | Đã thêm lại trong lần cập nhật này |
| 2 | `ci.yml` chưa khai báo `JWT_SECRET`. Unit test không cần, nhưng e2e test import `AppModule` sẽ lỗi | `.github/workflows/ci.yml` | Minor | Đã xử lý cho test: `e2e/setup-env.ts` đặt giá trị mặc định. `ci.yml` vẫn chưa khai báo |
| 3 | `AdminGuard` ném `TypeError` (lỗi 500) nếu dùng mà không có `JwtAuthGuard` đứng trước. UT-ADMIN-03 hiện chỉ kiểm tra "không cho qua" | `src/auth/admin.guard.ts` | Minor | Mở |
| 4 | Chưa có `RolesGuard` "mặc định từ chối" như roadmap Stage 1 Bước 4 | `src/auth/` | Major | Mở |
| 5 | Chưa giới hạn số lần đăng nhập sai (NFR-SEC-05) | `src/auth/auth.controller.ts` | Major | Mở |
| 6 | Luồng đặt mật khẩu bằng link (`/auth/set-password`) không đi tới được: không có code nào tạo token. Nếu gọi thì luôn gặp `EMAIL_EXISTS`, vì `submit` đã tạo tài khoản đang chờ | `AuthService.setPassword` | Minor | Mở, cần nhóm xác nhận còn dùng luồng này không |
| 7 | Danh sách yêu cầu đăng ký không phân trang (NFR-PERF-03) | `RegistrationRequestsService.list` | Minor | Mở |
| 8 | Tên role / trạng thái trong code (`medical`, `disabled`) khác SRS (`MEDICAL_STAFF`, `LOCKED`) | `src/users/user.entity.ts` | Trivial | Đã sửa (`84682a2`, migration `UseUppercaseRoleAndStatus`) |
| 9 | Sửa hồ sơ trẻ với tên rỗng hoặc toàn dấu cách vẫn được lưu: `UpdateChildDto.name` chỉ có `@MaxLength(150)`, trong khi lúc tạo bắt buộc 1–150 ký tự. Test: UT-CHILD-08d | `src/children/dto/update-child.dto.ts` | Minor | Mở |
| 10 | `ADMIN` và `MEDICAL_STAFF` nhận 403 ở mọi API `/children` và `/classes`. UC-04, UC-05 chỉ nêu Quản lý; bảng phân quyền trong `KidCare_Project_Plan.md` mục 15 cho Admin xem trẻ và Medical xem trẻ trong lớp. Test hiện ghi nhận hành vi đang có (UT-CHILD-09c, 10c, UT-CLASS-09c) | `children.service.ts`, `classes.service.ts` | Cần nhóm chốt | Mở |
| 11 | Admin đổi được role của chính mình, kể cả khi là admin cuối cùng, nên hệ thống có thể mất hết quyền quản trị. UC-03 chỉ cấm tự khóa / tự xóa | `UsersService.changeRole` | Minor, cần nhóm chốt | Mở |
| 12 | Todo UT-USER-03 ghi "limit vượt mức tối đa bị giới hạn", code thì trả 400. Test viết theo code | `ListUsersQueryDto` | Trivial, cần nhóm chốt | Mở |
| 13 | Làm theo README không chạy được backend: README bảo `cp .env.example .env` nhưng `backend/.env.example` không có trên `main`; `docker-compose.yml` map PostgreSQL ra cổng `5433` còn code mặc định `5432`; thiếu `JWT_SECRET` thì `AuthModule` ném lỗi ngay khi khởi động (NFR-MNT-03) | `README.md`, `docker-compose.yml`, `backend/` | Major | Mở |
| 14 | Entity lệch với migration: migration giai đoạn 2 tạo khóa ngoại, CHECK constraint và index mà entity không khai báo. Lần chạy `npm run migration:generate` tới sẽ sinh migration **xóa** các khóa ngoại và CHECK của `children`, `classes`, `class_teachers`, `child_parents`. Test: E2E-MIG-02 | `src/children/*.entity.ts`, `src/classes/*.entity.ts` | Major | Mở |
| 15 | Access token sống 1 giờ (`expiresIn: '1h'`), NFR-SEC-04 yêu cầu khoảng 15 phút. Test: E2E-AUTH-08 | `src/auth/auth.module.ts` | Minor, cần nhóm chốt | Mở |
| 16 | 2 request phân công cùng một giáo viên gửi đồng thời: database chặn trùng đúng, nhưng request thứ hai nhận 500 thay vì 409, vì `assignTeachers` không bắt unique violation (`linkParent` thì có bắt). Test: E2E-CLASS-03b | `ClassesService.assignTeachers` | Minor | Mở |
| 17 | `GET /audit-logs?from=2026-11-01T00:00:00Z&...` trả 500: DTO nhận chuỗi ISO có giờ, service ghép thêm `T00:00:00.000Z` thành ngày không hợp lệ, PostgreSQL báo lỗi. Test: E2E-AUDIT-04 | `AuditLogsService.list`, `ListAuditLogsQueryDto` | Minor | Mở |

## Cách cập nhật file này

Mỗi khi thêm hoặc chuyển test từ `todo` sang chạy thật:

1. Chạy `npm test` và ghi lại số Đạt / Todo / Lỗi.
2. Sửa bảng **Tổng quan** và bảng của file tương ứng.
3. Nếu sửa xong một vấn đề, đổi cột Trạng thái thành "Đã sửa", ghi commit.
4. Thêm một dòng vào **Lịch sử cập nhật**.

## Lịch sử cập nhật

| Ngày | Nội dung |
|---|---|
| 04/11/2026 | Thêm unit test giai đoạn 0–1 (121 test đạt), todo giai đoạn 2 (30) và `RolesGuard` (4); thêm lại script `test`, `test:e2e` |
| 06/11/2026 | Viết thân 30 todo giai đoạn 2 thành 88 test đạt (`UsersService`, `ClassesService`, `ChildrenService`); thêm QueryBuilder giả vào `helpers/mocks.ts`; ghi nhận vấn đề #9–#13; đánh dấu #8 đã sửa |
| 06/11/2026 | Thêm hạ tầng e2e (database tạm cho mỗi file) và 142 e2e test giai đoạn 0–2: health, migration, đăng nhập, token, đăng ký, ma trận phân quyền, IDOR, ghi đồng thời, transaction; ghi nhận vấn đề #14–#17 |
