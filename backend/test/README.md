# Tiến độ kiểm thử backend — KidCare

Cập nhật lần cuối: **09/11/2026**, trên `main` tại commit `bdf5064` (sau PR #20).

## Tổng quan

| Giai đoạn | Phạm vi | Đạt | Todo | Lỗi | Tình trạng |
|---|---|---|---|---|---|
| 0 | Hạ tầng: health check | 3 | 0 | 0 | ✅ Xong |
| 1 | Đăng nhập, đăng ký, duyệt đăng ký (UC-01, UC-02) | 118 | 4 | 0 | 🟡 Còn `RolesGuard` chưa có code |
| 2 | Tài khoản, lớp, hồ sơ trẻ (UC-03, UC-04, UC-05) | 88 | 0 | 0 | ✅ Unit xong |
| 3 | Điểm danh, nghỉ học (UC-06, UC-07, UC-08) | 214 | 0 | 0 | ✅ Unit xong |
| 4 | Hồ sơ sức khỏe (UC-09) | 0 | 0 | 0 | ⏸ Chưa có code; e2e viết trước, tự bỏ qua |
| 5 | Hoạt động, đón trẻ (UC-10, UC-11, UC-12) | 0 | 0 | 0 | ⏸ Chưa có code; e2e viết trước, tự bỏ qua |
| | **Tổng unit** | **423** | **4** | **0** | |

| E2E (API thật + PostgreSQL thật) | File | Đạt | Trong đó lỗi đã biết |
|---|---|---|---|
| 0 · Health, migration | `e2e/stage-0-infra.e2e-spec.ts` | 6 | 1 (#14) |
| 1 · Đăng nhập, token | `e2e/stage-1-auth.e2e-spec.ts` | 21 | 2 (#5, #15) |
| 1 · Đăng ký, duyệt | `e2e/stage-1-registration.e2e-spec.ts` | 14 | 0 |
| 2 · Phân quyền, IDOR | `e2e/stage-2-access.e2e-spec.ts` | 80 | 0 |
| 2 · Quản lý tài khoản, lớp, trẻ | `e2e/stage-2-management.e2e-spec.ts` | 21 | 3 (#9, #16, #17) |
| 3 · Điểm danh, đơn nghỉ | `attendance-leave.e2e-spec.ts` | 46 | 0 |
| 3 · Ràng buộc database | `database-constraints.e2e-spec.ts` | 9 | 0 |
| 3 · Response khớp `openapi.yaml` | `openapi-contract.e2e-spec.ts` | 3 | 0 |
| 4 · Hồ sơ sức khỏe | `e2e/stage-4-health.e2e-spec.ts` | 0 (102 bỏ qua) | 0 |
| 5 · Hoạt động, đón trẻ | `e2e/stage-5-activity-pickup.e2e-spec.ts` | 0 (93 bỏ qua) | 0 |
| **Tổng e2e** | | **200** | **6** |

Unit test stage 3 gồm 196 test trong `test/unit/stage-3/` và 18 test nằm cạnh code (`src/attendance/attendance-policy.spec.ts`: 14, `src/common/school-time.spec.ts`: 4). E2E stage 3 nằm ở gốc `test/`, do người viết code stage 3 viết kèm PR #19.

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
│   ├── helpers/app.ts      khung A: dựng app NestJS trên database tạm, tạo tài khoản + token JWT thật
│   ├── helpers/spec-first.ts   cho e2e viết trước code: tự bật khi có controller, đối chiếu phản hồi với openapi.yaml
│   ├── stage-<số>-*.e2e-spec.ts      e2e giai đoạn 0-2 (dùng khung A)
│   ├── stage-4-health.e2e-spec.ts    e2e giai đoạn 4, viết trước code (dùng khung B)
│   └── stage-5-activity-pickup.e2e-spec.ts   e2e giai đoạn 5, viết trước code (dùng khung B)
├── attendance-leave.e2e-spec.ts      e2e giai đoạn 3 (dùng khung B)
├── database-constraints.e2e-spec.ts
├── openapi-contract.e2e-spec.ts
├── helpers/
│   ├── mocks.ts            đồ giả dùng chung: repository, QueryBuilder, DataSource, ExecutionContext, kiểm tra DTO
│   └── test-app.ts         khung B: thay JwtAuthGuard bằng header x-test-user, dùng chung DB_DATABASE, seed sẵn dữ liệu
└── unit/
    ├── stage-0/            giai đoạn 0 — hạ tầng
    ├── stage-1/            giai đoạn 1 — đăng nhập, đăng ký
    ├── stage-2/            giai đoạn 2 — tài khoản, lớp, hồ sơ trẻ
    └── stage-3/            giai đoạn 3 — điểm danh, đơn nghỉ
```

- Unit test: `test/unit/stage-<số>/<tên>.spec.ts`. Kiểm tra một class, mọi phụ thuộc (repository, `DataSource`, `JwtService`, `argon2`) đều được giả lập. Không cần database.
- Tên nhóm test bắt đầu bằng `GĐ<số> ·`, tên test bắt đầu bằng mã `UT-...`, ví dụ `GĐ1 · AuthService › login › UT-LOGIN-02 sai mật khẩu → 401 INVALID_CREDENTIALS`.
- E2E test: `test/e2e/stage-<số>-<phạm vi>.e2e-spec.ts`, mã `E2E-...`. Gọi HTTP vào app NestJS thật (Supertest) với PostgreSQL thật.
- Có hai khung e2e, dùng cho hai mục đích khác nhau:
  - Khung A (`e2e/helpers/app.ts`): mỗi file tự tạo database tạm tên `kidcare_e2e_...`, chạy đủ migration, xong thì xóa. Đăng nhập bằng token JWT thật, nên dùng cho test xác thực và phân quyền.
  - Khung B (`helpers/test-app.ts`): bỏ qua JWT, đọc id người dùng từ header `x-test-user`. Dùng chung database `DB_DATABASE`, database này phải chạy migration trước, và **mỗi test `TRUNCATE` toàn bộ bảng**. Hợp với test nghiệp vụ cần nhiều vai trò.
- `app.close()` của Nest không đóng DataSource vì `DatabaseModule` tạo nó bằng `useFactory`. Cả hai khung đều tự đóng DataSource (`E2eApp.stop()`, `app.close()` trong `createTestApp`), nếu không Jest sẽ không thoát.
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

**Không chạy e2e trên database dev `mydb`.** Test giai đoạn 3 (khung B) xóa sạch mọi bảng của `DB_DATABASE`. Tạo một database riêng tên `kidcare_test` và chạy migration cho nó:

```bash
docker compose up -d db                                      # ở thư mục gốc repo
docker compose exec db createdb -U user kidcare_test         # chỉ cần một lần
cd backend

# bash / Git Bash
export DB_PORT=5433 DB_DATABASE=kidcare_test
npm run migration:run                                        # chạy lại mỗi khi có migration mới
npm run test:e2e -- --runInBand
npm run test:e2e -- --runInBand -t "E2E-IDOR"                # chỉ test IDOR

# PowerShell
$env:DB_PORT=5433; $env:DB_DATABASE="kidcare_test"
npm run migration:run
npm run test:e2e -- --runInBand
```

Biến môi trường chỉ có hiệu lực trong cửa sổ terminal đã đặt nó. Mở terminal mới thì phải đặt lại, nếu không test sẽ nối vào cổng 5432.

CI chạy `npm run migration:run` trước `npm run test:e2e` trên database trắng của service postgres.

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

### Giai đoạn 3 — `unit/stage-3/`

| File | Class được test | Mã test | Đạt | Todo |
|---|---|---|---|---|
| `child-access.service.spec.ts` | `ChildAccessService` | UT-ACCESS-01 → 13 | 16 | 0 |
| `attendance-leave-dto.spec.ts` | 5 DTO điểm danh, 3 DTO đơn nghỉ | UT-DTO-ATT-01 → 10, UT-DTO-LEAVE-01 → 05 | 48 | 0 |
| `attendance.service.spec.ts` | `AttendanceService` (UC-06, UC-07) | UT-ATT-01 → 73 | 74 | 0 |
| `leave-requests.service.spec.ts` | `LeaveRequestsService` (UC-08) | UT-LEAVE-01 → 44 | 49 | 0 |
| `db-errors.spec.ts` | `isUniqueViolation`, `isExclusionViolation` | UT-DBERR-01 → 03 | 9 | 0 |

Số 49 của `leave-requests.service.spec.ts` gồm 1 test `it.failing` (UT-LEAVE-05b, vấn đề #22).

"Bây giờ" được cố định là 10:00 ngày 09/11/2026 giờ Việt Nam bằng `jest.useFakeTimers`, nên kết quả không phụ thuộc lúc chạy. `ChildAccessService` dùng bản thật nối với repository giả, để test quyền đi qua đúng code kiểm tra quyền.

Kiểm tra:

- **Quyền và IDOR:** vai trò không được phép bị chặn trước khi chạm database; giáo viên chỉ thao tác lớp được phân công; phụ huynh đổi id trẻ trên URL nhận 403 và không đọc được dữ liệu; đơn nghỉ của phụ huynh khác trả 404 khi rút.
- **Giờ và trạng thái:** 08:00 là PRESENT, 08:01 là LATE; "hôm nay" tính theo giờ Việt Nam kể cả lúc 00:30 (17:30 UTC hôm trước); từ chối ngày/giờ tương lai (cho lệch 1 phút), giờ khác ngày điểm danh, ngày đã qua thiếu giờ; PRESENT/LATE do server tính lại khi sửa giờ.
- **Thứ tự check-in/out:** check-out khi chưa check-in, khi vắng, khi đã check-out đều 409; giờ về trước giờ đến 400.
- **Trùng và ghi đồng thời:** điểm danh trùng ngày và đơn nghỉ giao nhau bị 409, kể cả khi database báo lỗi ràng buộc (23505, 23P01) lúc hai request chạy song song; khóa dòng khi check-out, sửa điểm danh, duyệt và rút đơn.
- **Đơn nghỉ:** khoảng ngày hợp lệ; chỉ đơn PENDING/APPROVED tính là trùng; chỉ đơn PENDING được duyệt, từ chối, rút; từ chối lưu lý do.
- **Audit và sự kiện:** audit ghi trong cùng transaction với đúng người làm, hành động, giá trị trước/sau, IP; lý do nghỉ không bị ghi vào audit; sự kiện chỉ phát sau khi lưu thành công; lỗi giữa chừng được ném ra để rollback.
- **Hiệu năng:** gắn tên trẻ, lớp, phụ huynh theo lô, 3 đơn chỉ tốn 1 truy vấn mỗi bảng.

### Giai đoạn 4 — `e2e/stage-4-health.e2e-spec.ts`

Backend chưa có code hồ sơ sức khỏe. Test được viết trước theo hợp đồng UC-09 trong `docs/02-design/openapi.yaml`, chỉ gọi API qua HTTP nên không phụ thuộc tên entity hay bảng backend sẽ đặt.

File tự bỏ qua (`describe.skip`, qua `describeWhen` trong `e2e/helpers/spec-first.ts`) khi `src/` chưa có file `*.controller.ts` nào chứa `health-records` hoặc `health-summary`. Khi controller đầu tiên xuất hiện, test tự chạy và CI sẽ đỏ cho đến khi làm đủ hợp đồng. Muốn chạy trước để xem test đỏ: đặt `STAGE4_E2E=1`. Ngày 09/11/2026 chạy thử: 96 test đỏ vì 404, 6 test kiểm tra 404 (E2E-H4-34) đạt.

| Nhóm | Mã test | Số test |
|---|---|---|
| Ghi, xem, sửa số đo | E2E-H4-01 → 15 | 40 |
| Dị ứng, bệnh nền, quyền | E2E-H4-16 → 24 | 16 |
| Tiêm chủng | E2E-H4-25 → 29 | 9 |
| Lần khám | E2E-H4-30 → 33 | 11 |
| 404 khi trẻ không tồn tại | E2E-H4-34 | 6 |
| Tóm tắt theo vai trò | E2E-H4-35 → 42 | 11 |
| Cảnh báo của lớp | E2E-H4-43 → 46 | 7 |
| Audit, khớp `openapi.yaml` | E2E-H4-47, 48 | 2 |

Quy ước đã chốt trong OpenAPI (09/11/2026, lấy theo khoảng frontend đang dùng):

- **Đơn vị và khoảng hợp lệ (gồm hai đầu):** chiều cao 30-150 cm, cân nặng 2-50 kg, nhiệt độ 34-42 °C. Cần ít nhất một chỉ số.
- **Cảnh báo:** `abnormal` có `TEMPERATURE` khi nhiệt độ ≥ 37,5 °C (sốt) hoặc ≤ 35 °C (thân nhiệt thấp). Test kiểm tra 37,4 / 37,5 / 35 / 35,1.
- **Quyền:** chỉ MEDICAL_STAFF đọc và ghi chi tiết. PARENT (con mình) và TEACHER (lớp mình) chỉ đọc `health-summary`; MANAGER, ADMIN nhận 403. Cảnh báo lớp: TEACHER lớp mình, MANAGER và MEDICAL_STAFF mọi lớp.
- **Lọc theo vai trò:** phụ huynh không thấy ghi chú và kết luận khám; giáo viên chỉ thấy dị ứng và bệnh nền đang theo dõi. Test dùng chuỗi đánh dấu để chắc thông tin nhạy cảm không lọt ra, kể cả vào audit log.
- **Trùng:** dị ứng hoặc bệnh nền đang theo dõi cùng tên, mũi tiêm cùng tên vắc-xin và số mũi trả 409 (không phân biệt hoa thường).
- **Thời gian:** ngày tiêm và thời điểm khám không được ở tương lai; ngày hẹn mũi sau phải sau ngày tiêm; mũi "sắp tới" là mũi hẹn trong 30 ngày tới hoặc đã quá hẹn.

Khi backend làm stage 4, `resetDatabase` trong `helpers/test-app.ts` vẫn xóa được bảng sức khỏe nhờ `TRUNCATE ... CASCADE` (bảng có khóa ngoại tới `children`).

### Giai đoạn 5 — `e2e/stage-5-activity-pickup.e2e-spec.ts`

Backend chưa có code hoạt động và đón trẻ. Test viết trước theo hợp đồng UC-10, UC-11, UC-12 trong `docs/02-design/openapi.yaml`, cùng cách làm với giai đoạn 4.

Hai nhóm bật riêng: nhóm hoạt động chạy khi có controller chứa route `activities`, nhóm đón trẻ chạy khi có controller chứa `pickup-requests`. Đặt `STAGE5_E2E=1` để chạy cả hai trước. Ngày 09/11/2026 chạy thử: 92 test đỏ vì 404, 1 test kiểm tra 404 (E2E-A5-24) đạt. Các bước check-in, check-out gọi sang API giai đoạn 3 đều chạy đúng.

| Nhóm | Mã test | Số test |
|---|---|---|
| Tạo hoạt động | E2E-A5-01 → 08 | 22 |
| Danh sách hoạt động | E2E-A5-09 → 11 | 3 |
| Ghi nhận trẻ tham gia | E2E-A5-12 → 14 | 3 |
| Ảnh hoạt động | E2E-A5-15 → 20 | 8 |
| Hoạt động của một trẻ | E2E-A5-21 → 24 | 8 |
| Audit, khớp `openapi.yaml` (hoạt động) | E2E-A5-25, 26 | 2 |
| Đăng ký người đón | E2E-P5-01 → 06 | 25 |
| Danh sách yêu cầu đón | E2E-P5-07 → 10 | 4 |
| Hủy, duyệt, từ chối | E2E-P5-11 → 15 | 6 |
| Hoàn tất giao trẻ | E2E-P5-16 → 23 | 10 |
| Audit, khớp `openapi.yaml` (đón trẻ) | E2E-P5-24, 25 | 2 |

Quy ước đã chốt trong OpenAPI (09/11/2026, lấy theo mock của frontend):

- **Hoạt động:** chỉ TEACHER của lớp tạo và sửa; MANAGER chỉ xem. Ngày không được ở tương lai. Lớp CLOSED trả 409. Có trẻ không thuộc lớp hoặc đã nghỉ thì 400 và không lưu gì.
- **Ảnh:** JPEG, PNG, WEBP, kiểm tra theo nội dung file (file chữ đặt tên `.png` bị từ chối); tối đa 2 MB (vượt thì 413) và 6 ảnh mỗi hoạt động (ảnh thứ 7 trả 409).
- **Phụ huynh xem hoạt động của con:** chỉ hoạt động con có trạng thái JOINED; không trả danh sách trẻ khác, chỉ có `participantCount`.
- **Đón trẻ:** PARENT tạo và hủy; TEACHER của lớp duyệt, từ chối, hoàn tất; MANAGER, MEDICAL_STAFF, ADMIN nhận 403. Giấy tờ là CMND 9 số hoặc CCCD 12 số, bắt buộc. Thời gian đón không được ở quá khứ.
- **Che dữ liệu:** chỉ giáo viên của lớp thấy đủ số giấy tờ; phụ huynh thấy 4 số cuối. Audit không chứa số giấy tờ và số điện thoại.
- **Hoàn tất:** chỉ yêu cầu APPROVED của hôm nay, trẻ đã check-in và chưa check-out. Check-out và đổi trạng thái nằm trong cùng transaction. Hai request đồng thời thì đúng một request thành công.

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
| 2 | `ci.yml` chưa khai báo `JWT_SECRET`. Unit test không cần, nhưng e2e test import `AppModule` sẽ lỗi | `.github/workflows/ci.yml` | Minor | Đã sửa (`a856816`, PR #20). Commit `7e5b9b0` từng đưa secret thật vào `ci.yml`, PR #20 đã thay bằng giá trị chỉ dùng cho CI |
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
| 18 | CI không chạy migration trước e2e, nên trên database trắng 58/58 e2e giai đoạn 3 lỗi `relation "leave_requests" does not exist` | `.github/workflows/ci.yml` | Major | Đã sửa (`a856816`, PR #20) |
| 19 | `openapi.yaml` lệch với code giai đoạn 3: roster lớp, trạng thái hôm nay của trẻ, thiếu `PATCH /leave-requests/{id}/cancel`. Test: `openapi-contract.e2e-spec.ts` | `docs/02-design/openapi.yaml` | Minor | Đã sửa (`a856816`, PR #20) |
| 20 | `DatabaseModule` không đóng DataSource khi app tắt (`app.close()`). Trong test, Jest không thoát; khi chạy thật, tắt app không đóng kết nối PostgreSQL. Test đã tự đóng trong hai khung e2e. Nên thêm `OnApplicationShutdown` vào `DatabaseModule` | `src/database/database.module.ts` | Minor | Mở |
| 21 | Còn 6 cảnh báo lint (không làm CI đỏ): `no-misused-spread` ở `audit-logs.service.ts:101`, `require-array-sort-compare` ở `attendance-leave.e2e-spec.ts:96`, 4 `restrict-template-expressions` ở `openapi-contract.e2e-spec.ts` | `src/`, `test/` | Trivial | Mở |
| 22 | Đơn nghỉ dài 367 ngày vẫn được nhận dù thông báo lỗi ghi "tối đa 366 ngày": service so `daysBetween(from, to) > 366`, mà `daysBetween` không tính ngày đầu. Sửa: so `daysBetween(from, to) + 1 > 366` hoặc `>= 366`. Test: UT-LEAVE-05b | `LeaveRequestsService.validateDates` | Trivial | Mở |
| 23 | Bản ghi EARLY_LEAVE, giáo viên chỉ sửa giờ về (không gửi `status`) thì trạng thái bị tính lại thành PRESENT/LATE, mất EARLY_LEAVE. Test ghi nhận hành vi hiện tại: UT-ATT-52 | `AttendanceService.update` | Cần nhóm chốt | Mở |
| 24 | Phụ huynh rút đơn không phát sự kiện, nên khi có Stage 6 giáo viên sẽ không được báo đơn đã rút. Test ghi nhận hành vi hiện tại: UT-LEAVE-44 | `LeaveRequestsService.cancel` | Cần nhóm chốt | Mở |

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
| 09/11/2026 | Đưa test giai đoạn 0-2 (nhánh `feature/backend-tests-stage-0-2`) lên `main` sau PR #19, #20. Ghi nhận test giai đoạn 3 có sẵn (18 unit, 58 e2e) và hai khung e2e. `createTestApp` tự đóng DataSource để Jest thoát. Hướng dẫn chạy e2e trên database `kidcare_test` riêng. Đánh dấu #2 đã sửa; ghi nhận #18-#21. Kết quả: unit 227 đạt, 4 todo; e2e 200/200 đạt |
| 09/11/2026 | Thêm 196 unit test giai đoạn 3 (`ChildAccessService`, DTO, `AttendanceService`, `LeaveRequestsService`, `db-errors`); thêm `getMany`, `getOne`, `getExists` vào QueryBuilder giả; ghi nhận vấn đề #22-#24. Kết quả: unit 423 đạt, 4 todo |
| 09/11/2026 | Chốt hợp đồng UC-09 trong `openapi.yaml` (thêm 6 API dị ứng, bệnh nền; đơn vị, khoảng hợp lệ, ngưỡng sốt, lọc theo vai trò). Thêm 102 e2e giai đoạn 4 viết trước code, tự bỏ qua khi chưa có controller. Kết quả: e2e 200 đạt, 102 bỏ qua |
| 09/11/2026 | Chốt hợp đồng UC-10, UC-11, UC-12 trong `openapi.yaml` (quyền, giới hạn ảnh, che số giấy tờ, chuyển trạng thái đón trẻ). Thêm 93 e2e giai đoạn 5 viết trước code. Tách phần bật test và kiểm tra schema ra `e2e/helpers/spec-first.ts`. Sửa 5 mô tả trong `openapi.yaml` (PR #23) bị dấu phẩy cắt thành key thừa. Kết quả: e2e 200 đạt, 195 bỏ qua |
