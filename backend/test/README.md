# Tiến độ kiểm thử backend — KidCare

Cập nhật lần cuối: **04/11/2026**, trên `main` tại commit `9a7d421`.

## Tổng quan

| Giai đoạn | Phạm vi | Đạt | Todo | Lỗi | Tình trạng |
|---|---|---|---|---|---|
| 0 | Hạ tầng: health check | 3 | 0 | 0 | ✅ Xong |
| 1 | Đăng nhập, đăng ký, duyệt đăng ký (UC-01, UC-02) | 118 | 4 | 0 | 🟡 Còn `RolesGuard` chưa có code |
| 2 | Tài khoản, lớp, hồ sơ trẻ (UC-03, UC-04, UC-05) | 0 | 30 | 0 | ⏳ Chờ code |
| | **Tổng** | **121** | **34** | **0** | |

- **Đạt:** test đã chạy và qua.
- **Todo:** test đã đặt tên (`it.todo`) nhưng chưa viết phần thân, vì code tương ứng chưa có. Todo không làm CI đỏ.
- Số test lớn hơn số mã `UT-` vì mỗi `it.each` được tính thành nhiều test.

## Cấu trúc thư mục

```
backend/test/
├── README.md               file này
├── jest-e2e.json           cấu hình e2e test (chưa có file e2e nào)
├── helpers/
│   └── mocks.ts            đồ giả dùng chung: repository, DataSource, ExecutionContext, kiểm tra DTO
└── unit/
    ├── stage-0/            giai đoạn 0 — hạ tầng
    ├── stage-1/            giai đoạn 1 — đăng nhập, đăng ký
    └── stage-2/            giai đoạn 2 — tài khoản, lớp, hồ sơ trẻ
```

- Unit test: `test/unit/stage-<số>/<tên>.spec.ts`. Kiểm tra một class, mọi phụ thuộc (repository, `DataSource`, `JwtService`, `argon2`) đều được giả lập. Không cần database.
- Tên nhóm test bắt đầu bằng `GĐ<số> ·`, tên test bắt đầu bằng mã `UT-...`, ví dụ `GĐ1 · AuthService › login › UT-LOGIN-02 sai mật khẩu → 401 INVALID_CREDENTIALS`.

## Cách chạy

```bash
cd backend
npm test                                  # toàn bộ unit test
npm test -- test/unit/stage-1             # chỉ một giai đoạn
npm test -- -t "UT-LOGIN"                 # chỉ các test có mã UT-LOGIN
npm run test:cov                          # kèm báo cáo độ phủ code
npm run lint
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
| `users.service.spec.ts` | `UsersService` (UC-03) | UT-USER-01 → 11 | 0 | 11 |
| `classes.service.spec.ts` | `ClassesService` (UC-05) | UT-CLASS-01 → 09 | 0 | 9 |
| `children.service.spec.ts` | `ChildrenService` (UC-04) | UT-CHILD-01 → 10 | 0 | 10 |

Sẽ kiểm tra khi có code:

- **Quyền sở hữu:** đúng phụ huynh của trẻ thì được xem, phụ huynh khác thì không (UT-CHILD-09).
- **Tài khoản:** email trùng bị từ chối; admin không tự khóa được chính mình; đổi vai trò có ghi audit log.
- **Lớp học:** trùng tên trong cùng năm học bị từ chối; không đóng lớp còn trẻ; không phân công trùng giáo viên.
- **Transaction:** tạo trẻ + gắn phụ huynh lỗi giữa chừng thì không có dữ liệu dở dang (UT-CHILD-07).

Phần **chưa có** trong thư mục này, cần làm khi có API giai đoạn 2:

- [ ] Test IDOR (e2e): phụ huynh A gọi API xem con của phụ huynh B phải nhận 403; giáo viên lớp khác không xem được lớp.
- [ ] Test E2E: Quản lý tạo lớp → tạo trẻ → gắn phụ huynh → phụ huynh đăng nhập thấy con.
- [ ] Chạy lại toàn bộ test giai đoạn 0–1 (regression).

## Vấn đề phát hiện khi viết test

| # | Vấn đề | Vị trí | Mức độ | Trạng thái |
|---|---|---|---|---|
| 1 | `package.json` thiếu script `test`, `test:e2e`, nên CI lỗi | `backend/package.json` | Major | Đã thêm lại trong lần cập nhật này |
| 2 | `ci.yml` chưa khai báo `JWT_SECRET`. Unit test không cần, nhưng e2e test import `AppModule` sẽ lỗi | `.github/workflows/ci.yml` | Minor | Mở |
| 3 | `AdminGuard` ném `TypeError` (lỗi 500) nếu dùng mà không có `JwtAuthGuard` đứng trước. UT-ADMIN-03 hiện chỉ kiểm tra "không cho qua" | `src/auth/admin.guard.ts` | Minor | Mở |
| 4 | Chưa có `RolesGuard` "mặc định từ chối" như roadmap Stage 1 Bước 4 | `src/auth/` | Major | Mở |
| 5 | Chưa giới hạn số lần đăng nhập sai (NFR-SEC-05) | `src/auth/auth.controller.ts` | Major | Mở |
| 6 | Luồng đặt mật khẩu bằng link (`/auth/set-password`) không đi tới được: không có code nào tạo token. Nếu gọi thì luôn gặp `EMAIL_EXISTS`, vì `submit` đã tạo tài khoản đang chờ | `AuthService.setPassword` | Minor | Mở, cần nhóm xác nhận còn dùng luồng này không |
| 7 | Danh sách yêu cầu đăng ký không phân trang (NFR-PERF-03) | `RegistrationRequestsService.list` | Minor | Mở |
| 8 | Tên role / trạng thái trong code (`medical`, `disabled`) khác SRS (`MEDICAL_STAFF`, `LOCKED`) | `src/users/user.entity.ts` | Trivial | Mở |

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
