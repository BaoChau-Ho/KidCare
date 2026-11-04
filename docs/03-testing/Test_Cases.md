# Danh sách test case — KidCare

Danh sách test case theo Increment. Mã yêu cầu theo SRS, mã use case theo tài liệu đặc tả use case. Cách đặt mã xem [Test_Plan.md](Test_Plan.md) mục 4. Mẫu chi tiết một test case xem [Test_Case_Template.md](Test_Case_Template.md).

Mỗi test tự động có tên bắt đầu bằng mã TC, ví dụ `it('TC-AUTH-04 ...')`. Muốn chạy riêng một nhóm:

```bash
cd backend
npm run test:e2e -- -t "TC-AUTH"     # e2e / API
npm test -- -t "TC-ATT-01"            # unit
cd ../frontend
npx vitest run -t "TC-AUTH-12"
```

**Cột "Tự động":**

- **Có:** test đã chạy được.
- **Todo:** đã có trong file test dưới dạng `it.todo`, chờ API được code xong rồi viết phần thân test.
- **Tay:** kiểm tra bằng tay hoặc bằng công cụ ngoài Jest (k6, curl, trình duyệt).

## Increment 0 — Hạ tầng

File: `backend/test/inc0-health.e2e-spec.ts`. Dùng DataSource giả nên chạy được cả khi không có PostgreSQL.

| Mã | Tên | Yêu cầu | Mức | Tự động |
|---|---|---|---|---|
| TC-SYS-01 | `GET /health` trả 200, `status: ok`, `timestamp` dạng ISO | openapi `/health` | E2E | Có |
| TC-SYS-02 | `GET /health/ready` trả 200 khi database trả lời | openapi `/health/ready` | E2E | Có |
| TC-SYS-03 | `GET /health/ready` trả 503 khi database lỗi, không lộ chi tiết lỗi | NFR-SEC-08 | E2E | Có |
| TC-SYS-04 | Tài liệu Swagger có các endpoint health | NFR-MAIN-03 | E2E | Có |
| TC-SEC-01 | Đường dẫn không tồn tại trả 404, không lộ stack trace | NFR-SEC-08 | E2E | Có |

## Increment 1 — Xác thực và người dùng

File: `backend/test/inc1-auth.e2e-spec.ts`, `backend/test/inc1-users.e2e-spec.ts`, `frontend/src/__tests__/auth-service.test.js`.

| Mã | Tên | Yêu cầu | UC | Mức | Tự động |
|---|---|---|---|---|---|
| TC-AUTH-01 | Đăng ký phụ huynh hợp lệ → 201, vai trò PARENT | FR-AUTH-01 | UC-02 | API | Todo |
| TC-AUTH-02 | Đăng ký email đã tồn tại → 409 | FR-AUTH-01 | UC-02 (4a) | API | Todo |
| TC-AUTH-03 | Đăng ký thiếu trường hoặc mật khẩu yếu → 400 | FR-AUTH-01, NFR-SEC-04 | UC-02 (3a) | API | Todo |
| TC-AUTH-04 | Đăng nhập đúng → 200, có access token và vai trò | FR-AUTH-02 | UC-01 | API | Todo |
| TC-AUTH-05 | Sai email hoặc mật khẩu → 401, thông báo giống nhau cho cả hai trường hợp | FR-AUTH-02 | UC-01 (4a) | API | Todo |
| TC-AUTH-06 | Tài khoản bị khóa đăng nhập → 403 | FR-AUTH-02 | UC-01 (4c) | API | Todo |
| TC-AUTH-07 | Đăng xuất xong, refresh token cũ bị từ chối → 401 | FR-AUTH-03, NFR-SEC-09 | UC-01 (S1) | API | Todo |
| TC-AUTH-08 | Refresh token hợp lệ → access token mới | FR-AUTH-06 | — | API | Todo |
| TC-AUTH-09 | Đổi mật khẩu với mật khẩu hiện tại sai → bị từ chối | FR-AUTH-07 | — | API | Todo |
| TC-AUTH-10 | Gọi API cần đăng nhập mà không có token → 401 | FR-AUTH-05 | Tất cả | API | Todo |
| TC-AUTH-11 | Phụ huynh gọi API quản trị (`GET /users`) → 403 | FR-AUTH-05, NFR-SEC-03 | UC-03 | API | Todo |
| TC-AUTH-12 | (Frontend) Quy tắc mật khẩu: đủ 8 ký tự, chữ thường, chữ hoa, số, ký tự đặc biệt | NFR-SEC-04 | UC-02 | Unit | Có |
| TC-AUTH-13 | (Frontend) Không cho tự đăng ký vai trò Admin | FR-AUTH-04 | UC-02 | Unit | Có |
| TC-AUTH-14 | (Frontend) Đăng nhập trả đúng mã lỗi INVALID_CREDENTIALS, PENDING, DISABLED | FR-AUTH-02 | UC-01 | Unit | Có |
| TC-SEC-02 | Mật khẩu lưu dạng hash trong bảng `users` | NFR-SEC-01 | UC-02 | Integration | Todo |
| TC-SEC-03 | Access token hết hạn → 401 | NFR-SEC-02 | — | API | Todo |
| TC-SEC-04 | Access token bị sửa chữ ký → 401 | NFR-SEC-02 | — | API | Todo |
| TC-SEC-05 | Đăng nhập sai lần thứ 6 trong 1 phút → 429 | NFR-SEC-05 | UC-01 (4b) | API | Todo |
| TC-SEC-06 | Dữ liệu lạ (quá dài, sai kiểu, ký tự đặc biệt) vào API auth → 400, không 500 | NFR-SEC-04 | UC-01, UC-02 | API | Todo |
| TC-SEC-07 | Response người dùng không chứa `passwordHash` | NFR-SEC-08 | UC-03 | API | Todo |
| TC-SEC-08 | Quét mọi route: không có token → 401, trừ danh sách route công khai | NFR-SEC-03 | Tất cả | API | Todo |
| TC-USER-01 | Admin tạo tài khoản → 201 | FR-USER-01 | UC-03 (S1) | API | Todo |
| TC-USER-02 | Admin tạo tài khoản email trùng → 409 | FR-USER-01 | UC-03 (S1a) | API | Todo |
| TC-USER-03 | Admin đổi vai trò → 200, có audit log giá trị cũ / mới | FR-USER-02, FR-AUTH-04, NFR-SEC-06 | UC-03 (S2) | API | Todo |
| TC-USER-04 | Admin khóa tài khoản → tài khoản đó không đăng nhập được | FR-USER-01 | UC-03 (S3) | API | Todo |
| TC-USER-05 | Admin không khóa được chính mình | FR-USER-01 | UC-03 (S3a) | API | Todo |
| TC-USER-06 | `GET /users` có phân trang | NFR-PERF-03 | UC-03 | API | Todo |
| TC-USER-07 | Người dùng xem, sửa `/users/me` nhưng không tự đổi được vai trò | FR-USER-03, NFR-SEC-03 | — | API | Todo |

## Increment 2 — Quản lý cốt lõi

File: `backend/test/inc2-children.e2e-spec.ts`, `backend/test/inc2-classes.e2e-spec.ts`.

| Mã | Tên | Yêu cầu | UC | Mức | Tự động |
|---|---|---|---|---|---|
| TC-CHILD-01 | Quản lý tạo hồ sơ trẻ hợp lệ → 201, trạng thái ACTIVE | FR-CHILD-01 | UC-04 (S1) | API | Todo |
| TC-CHILD-02 | Tạo trẻ thiếu trường bắt buộc → 400 | FR-CHILD-01 | UC-04 (S1a) | API | Todo |
| TC-CHILD-03 | Liên kết phụ huynh với quan hệ FATHER / MOTHER / GUARDIAN → 201 | FR-CHILD-02 | UC-04 (S3) | API | Todo |
| TC-CHILD-04 | Liên kết phụ huynh trùng → 409 | FR-CHILD-02 | UC-04 (S3b) | API | Todo |
| TC-CHILD-05 | Trẻ đã có dữ liệu không bị xóa cứng, chỉ chuyển trạng thái | FR-CHILD-01 | UC-04 (S4a) | API | Todo |
| TC-CHILD-06 | Phụ huynh xem hồ sơ con mình → 200 | FR-CHILD-03 | UC-07 | API | Todo |
| TC-CHILD-07 | Phụ huynh A xem hồ sơ con của phụ huynh B → 403 (IDOR) | FR-CHILD-04, NFR-SEC-03 | UC-07 (3a) | Bảo mật | Todo |
| TC-CHILD-08 | `GET /children` có phân trang | NFR-PERF-03 | UC-04 | API | Todo |
| TC-REL-01 | Lỗi giữa chừng khi tạo trẻ + gắn phụ huynh → không còn dữ liệu dở dang | NFR-REL-02 | UC-04 | Integration | Todo |
| TC-CLASS-01 | Tạo lớp hợp lệ → 201 | FR-CLASS-01 | UC-05 (S1) | API | Todo |
| TC-CLASS-02 | Tạo lớp trùng tên trong cùng năm học → 409 | FR-CLASS-01 | UC-05 (S1a) | API | Todo |
| TC-CLASS-03 | Đóng lớp khi còn trẻ đang học → bị từ chối | FR-CLASS-01 | UC-05 (S2a) | API | Todo |
| TC-CLASS-04 | Phân công giáo viên; phân công lại không tạo bản ghi trùng | FR-CLASS-04 | UC-05 (S3, S3a) | API | Todo |
| TC-CLASS-05 | Gỡ phân công giáo viên khỏi lớp | FR-CLASS-04 | UC-05 (S3) | API | Todo |
| TC-CLASS-06 | Xếp trẻ vào lớp | FR-CLASS-03 | UC-04 | API | Todo |
| TC-CLASS-07 | Giáo viên xem lớp được phân công → 200; lớp khác → 403 | FR-CLASS-05, NFR-SEC-03 | UC-06 | Bảo mật | Todo |

## Increment 3 — Điểm danh

File: `backend/test/unit/inc3-attendance-status.spec.ts` (unit), `backend/test/inc3-attendance.e2e-spec.ts`.

| Mã | Tên | Yêu cầu | UC | Mức | Tự động |
|---|---|---|---|---|---|
| TC-ATT-01 | Giờ chuẩn 08:00: đến 08:00 → PRESENT, 08:01 → LATE | FR-ATT-01 | UC-06 (S1) | Unit | Todo |
| TC-ATT-02 | Check-in lưu giờ đến và người điểm danh (`recorded_by`) | FR-ATT-02, FR-ATT-03 | UC-06 | API | Todo |
| TC-ATT-03 | Check-out khi trẻ chưa check-in → bị từ chối | FR-ATT-02 | UC-06 (S2a) | API | Todo |
| TC-ATT-04 | Check-out trước giờ tan học → EARLY_LEAVE | FR-ATT-01 | UC-06 (S2) | Unit + API | Todo |
| TC-ATT-05 | Giáo viên điểm danh trẻ lớp khác → 403 | NFR-SEC-03 | UC-06 | Bảo mật | Todo |
| TC-ATT-06 | Phụ huynh xem điểm danh hôm nay của con → 200; con người khác → 403 | FR-ATT-05, FR-CHILD-04 | UC-07 | Bảo mật | Todo |
| TC-ATT-07 | Lịch sử điểm danh có phân trang | FR-ATT-04, NFR-PERF-03 | UC-07 (S1) | API | Todo |
| TC-ATT-08 | Check-in tạo thông báo cho phụ huynh của trẻ | FR-ATT-06 | UC-06 | Integration | Todo |
| TC-ATT-09 | Gửi đơn xin nghỉ hợp lệ → 201, giáo viên lớp nhận thông báo | FR-ATT-07 | UC-08 | API | Todo |
| TC-ATT-10 | Đơn xin nghỉ ngày quá khứ, ngày kết thúc trước ngày bắt đầu, hoặc trùng ngày → bị từ chối | FR-ATT-07 | UC-08 (3a, 3b) | API | Todo |
| TC-REL-02 | Hai yêu cầu check-in đồng thời cùng trẻ, cùng ngày → chỉ 1 bản ghi | NFR-REL-01 | UC-06 | Integration | Todo |
| TC-PERF-01 | `GET /children/{childId}/attendance/today` p95 < 500 ms với 10.000 bản ghi | NFR-PERF-01 | UC-07 | Hiệu năng | Tay (k6) |
| TC-PERF-02 | Nhiều request đồng thời vào API điểm danh không lỗi | NFR-PERF-02 | UC-06 | Hiệu năng | Tay (k6) |

## Increment 4 — Sức khỏe

File: `backend/test/inc4-health-records.e2e-spec.ts`.

| Mã | Tên | Yêu cầu | UC | Mức | Tự động |
|---|---|---|---|---|---|
| TC-HEALTH-01 | Nhân viên y tế tạo hồ sơ sức khỏe hợp lệ → 201 | FR-HEALTH-01 | UC-09 (S1) | API | Todo |
| TC-HEALTH-02 | Chỉ số không hợp lệ (cân nặng âm, nhiệt độ ngoài khoảng) → 400 | FR-HEALTH-01 | UC-09 (5a) | API | Todo |
| TC-HEALTH-03 | Nhiệt độ sốt → thông báo cho phụ huynh và giáo viên | FR-HEALTH-01 | UC-09 (S1a) | Integration | Todo |
| TC-HEALTH-04 | Thêm thông tin tiêm chủng | FR-HEALTH-02 | UC-09 (S3) | API | Todo |
| TC-HEALTH-05 | Thêm lần khám | FR-HEALTH-05 | UC-09 (S4) | API | Todo |
| TC-HEALTH-06 | Sửa hồ sơ sức khỏe → có audit log giá trị cũ / mới | FR-HEALTH-07, NFR-SEC-06 | UC-09 | Integration | Todo |
| TC-HEALTH-07 | Phụ huynh xem tóm tắt sức khỏe của con, chỉ có các trường được phép | FR-HEALTH-04, NFR-SEC-08 | UC-07 (S2) | Bảo mật | Todo |
| TC-HEALTH-08 | Giáo viên hoặc phụ huynh tạo hồ sơ sức khỏe → 403 | NFR-SEC-03 | UC-09 | Bảo mật | Todo |
| TC-SEC-09 | Log không chứa chi tiết sức khỏe, mật khẩu, khóa bí mật | NFR-MAIN-05 | UC-09 | Bảo mật | Tay |

## Increment 5 — Hoạt động và thông báo

File: `backend/test/inc5-activities.e2e-spec.ts`, `backend/test/inc5-notifications.e2e-spec.ts`.

| Mã | Tên | Yêu cầu | UC | Mức | Tự động |
|---|---|---|---|---|---|
| TC-ACT-01 | Giáo viên tạo hoạt động cho lớp được phân công → 201 | FR-ACT-01 | UC-10 | API | Todo |
| TC-ACT-02 | Giáo viên tạo hoạt động cho lớp khác → 403 | NFR-SEC-03 | UC-10 (2a) | Bảo mật | Todo |
| TC-ACT-03 | Thiếu tiêu đề hoặc ngày → 400 | FR-ACT-01 | UC-10 (6a) | API | Todo |
| TC-ACT-04 | Thêm trẻ tham gia hoạt động | FR-ACT-02 | UC-10 (S1) | API | Todo |
| TC-ACT-05 | Phụ huynh xem hoạt động của con | FR-ACT-03 | UC-07 (S3) | API | Todo |
| TC-ACT-06 | Ảnh sai định dạng hoặc quá dung lượng → 400 | FR-ACT-05 | UC-10 (S2a) | API | Todo |
| TC-NOTI-01 | Giáo viên gửi thông báo cả lớp → mỗi phụ huynh nhận đúng 1 thông báo | FR-NOTI-02 | UC-13 (S1) | API | Todo |
| TC-NOTI-02 | Giáo viên gửi thông báo cho lớp không phụ trách → 403 | NFR-SEC-03 | UC-13 | Bảo mật | Todo |
| TC-NOTI-03 | Danh sách thông báo chỉ gồm thông báo của người đang đăng nhập, có phân trang | FR-NOTI-03, NFR-PERF-03 | UC-14 | API | Todo |
| TC-NOTI-04 | Đánh dấu đã đọc thông báo của người khác → bị từ chối | NFR-SEC-03 | UC-14 | Bảo mật | Todo |
| TC-NOTI-05 | Số thông báo chưa đọc giảm sau khi đọc | FR-NOTI-03 | UC-14 | API | Todo |

## Kiểm thử tổng thể (tuần 11)

| Mã | Tên | Yêu cầu | Mức | Tự động |
|---|---|---|---|---|
| TC-SEC-10 | Bản deploy dùng HTTPS; `http://` được chuyển hướng hoặc bị chặn | NFR-SEC-07 | Bảo mật | Tay |
| TC-REL-03 | Backup database, xóa dữ liệu thử, khôi phục và đối chiếu | NFR-REL-03 | Độ tin cậy | Tay |

Increment 6 (đón trẻ, báo cáo) nằm ngoài phạm vi kiểm thử hiện tại (Test_Plan mục 2). Sẽ bổ sung test case nếu nhóm làm phần này.
