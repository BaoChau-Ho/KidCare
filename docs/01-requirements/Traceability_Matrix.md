# Bảng truy vết — KidCare

Đọc từ trái sang phải: yêu cầu nào → use case nào → thiết kế → API nào → test nào → xong chưa. Mục đích là chứng minh không sót yêu cầu nào và không có code thừa không ai yêu cầu.

> Vai A giữ bảng chuẩn và cập nhật yêu cầu, use case. Vai E cập nhật cột test case và trạng thái. Đối chiếu cuối mỗi Increment.

**Nguồn mã:** mã FR, NFR và mức ưu tiên lấy theo tài liệu SRS (`02_SRS.md`). Mã UC lấy theo tài liệu đặc tả use case (`04_Dac_Ta_Use_Case.md`).

**Quy ước mã:**

- FR / NFR: yêu cầu chức năng / phi chức năng, theo SRS.
- UC-xx: use case.
- API: theo `docs/02-design/openapi.yaml` trên `main`.
- ACT/SEQ/CLS-xx: sơ đồ Activity / Sequence / Class của use case UC-xx.
- TC-<MODULE>-<số>: test case, dùng cùng tên module với FR (`AUTH`, `USER`, `CHILD`, `CLASS`, `ATT`, `HEALTH`, `ACT`, `PICK`, `NOTI`, `REP`), thêm `SEC`, `PERF`, `REL` cho NFR.

**Ưu tiên:** Must (MVP) / Should (làm sau MVP) / Could (mở rộng).

**Increment:**

| Inc | Nội dung |
|---|---|
| 1 | Nền tảng và xác thực |
| 2 | Quản lý cốt lõi |
| 3 | Điểm danh |
| 4 | Sức khỏe |
| 5 | Hoạt động và thông báo |
| 6 | Mở rộng: đón trẻ, báo cáo |

**Trạng thái:** Chưa / Đang làm / Xong.

## Yêu cầu chức năng

### Xác thực và phân quyền

| FR | Mô tả | Ưu tiên | Inc | Use case | Thiết kế | API | Test case | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| FR-AUTH-01 | Đăng ký tài khoản | Must | 1 | UC-02 | ACT/SEQ/CLS-02 | `POST /auth/register`, `GET /admin/registration-requests`, `PATCH /auth/{id}/approve`, `PATCH /admin/registration-requests/{id}/reject`, `POST /auth/set-password` | TC-AUTH-01, 02, 03 | Chưa |
| FR-AUTH-02 | Đăng nhập | Must | 1 | UC-01 | ACT/SEQ/CLS-01 | `POST /auth/login` | TC-AUTH-04, 05, 06, 14 | Chưa |
| FR-AUTH-03 | Đăng xuất | Must | 1 | UC-01 (S1) | ACT/SEQ/CLS-01 | `POST /auth/logout` | TC-AUTH-07 | Chưa |
| FR-AUTH-04 | Gán role cho tài khoản | Must | 1 | UC-03 | ACT/SEQ/CLS-03 | `PATCH /users/{userId}/role` | TC-USER-03, TC-AUTH-13 | Chưa |
| FR-AUTH-05 | Kiểm tra permission trước mọi thao tác | Must | 1 | Tất cả | Guard (mọi SEQ) | Mọi API | TC-AUTH-10, 11, TC-SEC-08 | Chưa |
| FR-AUTH-06 | Làm mới phiên đăng nhập (Refresh Token) | Should | 1 | — | — | `POST /auth/refresh` | TC-AUTH-08 | Chưa |
| FR-AUTH-07 | Đổi mật khẩu và khôi phục mật khẩu | Should | 1 | — | — | `POST /auth/change-password`; khôi phục mật khẩu: chưa có trong openapi | TC-AUTH-09 | Chưa |

### Quản lý người dùng

| FR | Mô tả | Ưu tiên | Inc | Use case | Thiết kế | API | Test case | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| FR-USER-01 | Admin tạo, sửa, khóa, xóa tài khoản | Must | 1 | UC-03 | ACT/SEQ/CLS-03 | `GET/POST /users`, `PATCH /users/{userId}`, `PATCH /users/{userId}/status` (openapi chưa có xóa) | TC-USER-01, 02, 04, 05 | Chưa |
| FR-USER-02 | Admin quản lý role và permission | Must | 1 | UC-03 | ACT/SEQ/CLS-03 | `PATCH /users/{userId}/role` | TC-USER-03 | Chưa |
| FR-USER-03 | Người dùng xem, cập nhật thông tin cá nhân | Must | 1 | — | — | `GET/PATCH /users/me`, `GET /auth/me` | TC-USER-07 | Chưa |
| FR-USER-04 | Admin xem audit log | Should | 1 | — | — | Chưa có trong openapi | — | Chưa |

### Quản lý phụ huynh và trẻ

| FR | Mô tả | Ưu tiên | Inc | Use case | Thiết kế | API | Test case | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| FR-CHILD-01 | Manager thêm, sửa, xem, xóa hồ sơ trẻ | Must | 2 | UC-04 | ACT/SEQ/CLS-04 | `GET/POST /children`, `GET/PATCH /children/{childId}` (xóa = đổi trạng thái) | TC-CHILD-01, 02, 05 | Chưa |
| FR-CHILD-02 | Liên kết trẻ – phụ huynh (N–N) kèm quan hệ | Must | 2 | UC-04 | ACT/SEQ/CLS-04 | `POST /children/{childId}/parents` | TC-CHILD-03, 04 | Chưa |
| FR-CHILD-03 | Phụ huynh xem, cập nhật thông tin con | Must | 2 | UC-07 | ACT/SEQ/CLS-07 | `GET/PATCH /children/{childId}` | TC-CHILD-06 | Chưa |
| FR-CHILD-04 | Phụ huynh chỉ xem được dữ liệu của con mình | Must | 2 | UC-07 | SEQ-07 (OwnershipGuard) | Mọi API `/children/{childId}/...` | TC-CHILD-07, TC-ATT-06 | Chưa |

### Quản lý lớp và giáo viên

| FR | Mô tả | Ưu tiên | Inc | Use case | Thiết kế | API | Test case | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| FR-CLASS-01 | Manager thêm, sửa, xem, xóa lớp | Must | 2 | UC-05 | ACT/SEQ/CLS-05 | `GET/POST /classes`, `GET/PATCH /classes/{classId}` | TC-CLASS-01, 02, 03 | Chưa |
| FR-CLASS-02 | Manager quản lý thông tin giáo viên | Must | 2 | — | — | `POST /users` (role TEACHER); chưa có endpoint riêng cho giáo viên | — | Chưa |
| FR-CLASS-03 | Xếp trẻ vào lớp | Must | 2 | UC-04 | ACT/SEQ/CLS-04 | `PATCH /children/{childId}` | TC-CLASS-06 | Chưa |
| FR-CLASS-04 | Phân công giáo viên vào lớp (N–N) | Must | 2 | UC-05 | ACT/SEQ/CLS-05 | `POST /classes/{classId}/teachers`, `DELETE /classes/{classId}/teachers/{teacherUserId}` | TC-CLASS-04, 05 | Chưa |
| FR-CLASS-05 | Giáo viên xem danh sách trẻ trong lớp mình | Must | 2 | UC-06 | ACT-06 | `GET /classes/{classId}/attendance` | TC-CLASS-07 | Chưa |

### Điểm danh

| FR | Mô tả | Ưu tiên | Inc | Use case | Thiết kế | API | Test case | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| FR-ATT-01 | Điểm danh với trạng thái PRESENT, ABSENT, LATE, EARLY_LEAVE | Must | 3 | UC-06 | ACT/SEQ/CLS-06 | `POST /attendance/check-in`, `POST /attendance/check-out`, `PATCH /attendance/{attendanceId}` | TC-ATT-01, 04 | Chưa |
| FR-ATT-02 | Ghi nhận giờ đến (check-in), giờ về (check-out) | Must | 3 | UC-06 | ACT/SEQ/CLS-06 | `POST /attendance/check-in`, `POST /attendance/check-out` | TC-ATT-02, 03 | Chưa |
| FR-ATT-03 | Lưu người thực hiện điểm danh (`recorded_by`) | Must | 3 | UC-06 | SEQ/CLS-06 | `POST /attendance/check-in` | TC-ATT-02 | Chưa |
| FR-ATT-04 | Xem lịch sử điểm danh của trẻ | Must | 3 | UC-07 (S1) | ACT/SEQ-07 | `GET /children/{childId}/attendance` | TC-ATT-07 | Chưa |
| FR-ATT-05 | Phụ huynh xem trạng thái điểm danh hôm nay | Must | 3 | UC-07 | ACT/SEQ-07 | `GET /children/{childId}/attendance/today` | TC-ATT-06 | Chưa |
| FR-ATT-06 | Gửi thông báo cho phụ huynh khi check-in / check-out | Must | 3 | UC-06 | ACT/SEQ-06 | (nội bộ, NotificationService) | TC-ATT-08 | Chưa |
| FR-ATT-07 | Phụ huynh gửi yêu cầu nghỉ học | Should | 3 | UC-08 | ACT/SEQ/CLS-08 | `POST /leave-requests`, `GET /leave-requests`, `POST /leave-requests/{requestId}/approve`, `.../reject` | TC-ATT-09, 10 | Chưa |
| FR-ATT-08 | Điểm danh bằng QR Code | Could | 6 | — | — | — | — | Chưa |

### Sức khỏe

| FR | Mô tả | Ưu tiên | Inc | Use case | Thiết kế | API | Test case | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| FR-HEALTH-01 | Tạo, cập nhật hồ sơ sức khỏe (chiều cao, cân nặng, nhiệt độ...) | Must | 4 | UC-09 (S1) | ACT/SEQ/CLS-09 | `POST /children/{childId}/health-records`, `PATCH /health-records/{recordId}` | TC-HEALTH-01, 02, 03 | Chưa |
| FR-HEALTH-02 | Quản lý tiêm chủng | Must | 4 | UC-09 (S3) | ACT/CLS-09 | `GET/POST /children/{childId}/vaccinations` | TC-HEALTH-04 | Chưa |
| FR-HEALTH-03 | Quản lý dị ứng và bệnh nền | Must | 4 | UC-09 (S2) | ACT/CLS-09 | Chưa có endpoint riêng trong openapi | — | Chưa |
| FR-HEALTH-04 | Phụ huynh xem hồ sơ sức khỏe của con (giới hạn) | Must | 4 | UC-07 (S2) | SEQ/CLS-07 | `GET /children/{childId}/health-summary` | TC-HEALTH-07 | Chưa |
| FR-HEALTH-05 | Ghi nhận các lần khám | Should | 4 | UC-09 (S4) | ACT/CLS-09 | `GET/POST /children/{childId}/medical-visits` | TC-HEALTH-05 | Chưa |
| FR-HEALTH-06 | Quản lý lịch sử dùng thuốc | Should | 4 | UC-09 (S4) | ACT/CLS-09 | Chưa có endpoint riêng trong openapi | — | Chưa |
| FR-HEALTH-07 | Ghi audit log khi thay đổi hồ sơ sức khỏe | Should | 4 | UC-09 | ACT/SEQ-09 | (nội bộ, AuditService) | TC-HEALTH-06 | Chưa |

### Hoạt động

| FR | Mô tả | Ưu tiên | Inc | Use case | Thiết kế | API | Test case | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| FR-ACT-01 | Giáo viên tạo hoạt động cho lớp | Must | 5 | UC-10 | ACT/SEQ/CLS-10 | `POST /activities` | TC-ACT-01, 03 | Chưa |
| FR-ACT-02 | Ghi nhận trẻ tham gia hoạt động | Must | 5 | UC-10 (S1) | ACT/SEQ/CLS-10 | `POST /activities/{activityId}/participants` | TC-ACT-04 | Chưa |
| FR-ACT-03 | Phụ huynh xem hoạt động của con | Must | 5 | UC-07 (S3) | ACT-07 | `GET /children/{childId}/activities` | TC-ACT-05 | Chưa |
| FR-ACT-04 | Giáo viên đánh giá tình trạng của trẻ | Should | 5 | — | — | — | — | Chưa |
| FR-ACT-05 | Đính kèm ảnh hoạt động (Object Storage) | Could | 5 | UC-10 (S2) | ACT/SEQ/CLS-10 | `POST /activities/{activityId}/images` | TC-ACT-06 | Chưa |

### Đón trẻ

| FR | Mô tả | Ưu tiên | Inc | Use case | Thiết kế | API | Test case | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| FR-PICK-01 | Phụ huynh đăng ký người đón trẻ | Should | 6 | UC-11 | ACT/SEQ/CLS-11 | `POST /pickup-requests`, `PATCH /pickup-requests/{requestId}/cancel` | — | Chưa |
| FR-PICK-02 | Giáo viên xác minh, duyệt hoặc từ chối yêu cầu đón | Should | 6 | UC-12 | ACT/SEQ/CLS-12 | `PATCH /pickup-requests/{requestId}/approve`, `.../reject` | — | Chưa |
| FR-PICK-03 | Giáo viên xác nhận đã giao trẻ (COMPLETED) | Should | 6 | UC-12 | ACT/SEQ/CLS-12 | `PATCH /pickup-requests/{requestId}/complete` | — | Chưa |
| FR-PICK-04 | Lưu lịch sử đón trẻ và người xác minh | Should | 6 | UC-12 | SEQ/CLS-12 | `GET /pickup-requests` | — | Chưa |
| FR-PICK-05 | Thông báo phụ huynh khi yêu cầu đón đổi trạng thái | Should | 6 | UC-11, UC-12 | SEQ-11, SEQ-12 | (nội bộ, NotificationService) | — | Chưa |

### Thông báo

| FR | Mô tả | Ưu tiên | Inc | Use case | Thiết kế | API | Test case | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| FR-NOTI-01 | Tạo thông báo IN_APP từ các sự kiện của hệ thống | Must | 5 | UC-06, 09, 10, 12 | SEQ-06, 09, 10, 12 | (nội bộ, NotificationService) | TC-ATT-08, TC-HEALTH-03 | Chưa |
| FR-NOTI-02 | Giáo viên gửi thông báo cho phụ huynh | Must | 5 | UC-13 | ACT/SEQ/CLS-13 | `POST /notifications/broadcast` | TC-NOTI-01, 02 | Chưa |
| FR-NOTI-03 | Người dùng xem danh sách thông báo | Must | 5 | UC-14 | ACT/SEQ/CLS-14 | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/{notificationId}/read` | TC-NOTI-03, 04, 05 | Chưa |
| FR-NOTI-04 | Thông báo qua Push, Email, SMS | Could | 6 | — | — | — | — | Chưa |

### Báo cáo

| FR | Mô tả | Ưu tiên | Inc | Use case | Thiết kế | API | Test case | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| FR-REP-01 | Báo cáo số trẻ đi học trong ngày | Should | 6 | UC-15 (S1) | ACT/SEQ/CLS-15 | `GET /reports/attendance` | — | Chưa |
| FR-REP-02 | Báo cáo tỷ lệ chuyên cần, số trẻ đi muộn | Should | 6 | UC-15 (S1) | ACT/SEQ/CLS-15 | `GET /reports/attendance` | — | Chưa |
| FR-REP-03 | Báo cáo tình trạng sức khỏe | Should | 6 | UC-15 (S2) | ACT/CLS-15 | `GET /reports/health` | — | Chưa |
| FR-REP-04 | Báo cáo số lượng hoạt động | Should | 6 | UC-15 (S3) | ACT/CLS-15 | `GET /reports/classes` (cần xác nhận có số hoạt động) | — | Chưa |
| FR-REP-05 | Lọc báo cáo theo lớp và khoảng thời gian | Should | 6 | UC-15 | ACT/SEQ-15 | Tham số `classId`, `from`, `to` | — | Chưa |

## Yêu cầu phi chức năng

Chi tiết cách kiểm tra, công cụ và thời điểm kiểm xem [NFR.md](NFR.md).

| NFR | Mô tả ngắn | Cách kiểm tra | Test case | Trạng thái |
|---|---|---|---|---|
| NFR-PERF-01 | API thông thường < 500 ms | Đo với khoảng 10.000 bản ghi điểm danh (k6 / autocannon) | TC-PERF-01 | Chưa |
| NFR-PERF-02 | Hỗ trợ nhiều request đồng thời | Gửi nhiều request song song, kiểm tra không lỗi và thời gian phản hồi | TC-PERF-02 | Chưa |
| NFR-PERF-03 | API danh sách có phân trang | Gọi API danh sách với dữ liệu lớn → số bản ghi bị giới hạn theo trang | TC-USER-06, TC-CHILD-08, TC-ATT-07, TC-NOTI-03 | Chưa |
| NFR-SEC-01 | Mật khẩu được hash | Xem bảng `users`, không có mật khẩu rõ | TC-SEC-02 | Chưa |
| NFR-SEC-02 | Xác thực bằng JWT / session | Token hết hạn hoặc giả mạo → 401 | TC-SEC-03, 04 | Chưa |
| NFR-SEC-03 | RBAC ở mọi API, quyền tối thiểu | Sai vai trò → 403; đổi `:id` sang dữ liệu người khác → 403 (IDOR); API chưa khai báo vai trò bị chặn | TC-AUTH-11, TC-SEC-08, TC-CHILD-07, TC-CLASS-07, TC-ATT-05, 06, TC-HEALTH-08, TC-ACT-02, TC-NOTI-02, 04 | Chưa |
| NFR-SEC-04 | Kiểm tra dữ liệu đầu vào | Dữ liệu sai định dạng, quá dài, ký tự lạ → 400, không lỗi 500 | TC-SEC-06, TC-AUTH-03, 12 | Chưa |
| NFR-SEC-05 | Rate limiting cho API xác thực | Đăng nhập sai liên tục → bị chặn (429) | TC-SEC-05 | Chưa |
| NFR-SEC-06 | Ghi audit log thao tác quan trọng | Thực hiện thao tác → kiểm tra bản ghi `audit_logs` | TC-USER-03, TC-HEALTH-06 | Chưa |
| NFR-SEC-07 | Giao tiếp qua HTTPS / TLS | Truy cập `http://` được chuyển hướng hoặc bị chặn | TC-SEC-10 | Chưa |
| NFR-SEC-08 | Không trả dữ liệu trẻ vượt mức cần thiết | Kiểm tra response theo từng vai trò (ví dụ phụ huynh chỉ nhận trường sức khỏe được phép) | TC-SEC-01, 07, TC-SYS-03, TC-HEALTH-07 | Chưa |
| NFR-SEC-09 | Lưu trữ và xử lý token an toàn | Dùng refresh token sau khi đăng xuất → 401 | TC-AUTH-07 | Chưa |
| NFR-REL-01 | Không mất dữ liệu điểm danh | Gửi 2 yêu cầu điểm danh song song → chỉ 1 bản ghi (ràng buộc duy nhất trẻ + ngày) | TC-REL-02 | Chưa |
| NFR-REL-02 | Nghiệp vụ quan trọng chạy trong transaction | Gây lỗi giữa chừng (tạo trẻ + gắn phụ huynh, đón trẻ + check-out) → không còn dữ liệu dở dang | TC-REL-01 | Chưa |
| NFR-REL-03 | Sao lưu cơ sở dữ liệu định kỳ | Tạo backup, xóa dữ liệu thử, khôi phục và đối chiếu | TC-REL-03 | Chưa |
| NFR-SCAL-01 | Mở rộng dần từ 100 đến 1.000.000 trẻ | Đánh giá trong tài liệu kiến trúc | — | Chưa |
| NFR-SCAL-02 | Module có ranh giới rõ, tách được thành service | Review: module không truy cập trực tiếp bảng của module khác | — | Chưa |
| NFR-MAIN-01 | Kiến trúc Modular Monolith | Xem cấu trúc thư mục `backend/src` | — | Chưa |
| NFR-MAIN-02 | Clean code | Lint chạy trong CI, review PR | — | Chưa |
| NFR-MAIN-03 | Có tài liệu API | Trang Swagger / `openapi.yaml` đầy đủ | TC-SYS-04 | Chưa |
| NFR-MAIN-04 | Có kiểm thử tự động | CI chạy unit, integration, E2E trên mỗi PR | — | Chưa |
| NFR-MAIN-05 | Có ghi log hệ thống | Kiểm tra log khi chạy, không chứa dữ liệu nhạy cảm | TC-SEC-09 | Chưa |

## Kiểm tra cuối mỗi Increment

- [ ] Mọi FR Must của Increment có use case, thiết kế, API và test case.
- [ ] Mỗi test case có mã FR hoặc NFR tương ứng.
- [ ] Không có API nào ngoài `openapi.yaml`, và mọi API trong `openapi.yaml` có test.
- [ ] Trạng thái khớp với thực tế trên nhánh `develop`.
