# Roadmap — KidCare

Các stage sắp xếp theo phụ thuộc dữ liệu và chức năng. Mỗi roadmap ghi phạm vi, thứ tự triển khai và điều kiện hoàn tất; chỉnh roadmap, OpenAPI và UC cùng lúc khi nhóm thay đổi quyết định.

| Stage | Phạm vi | Tài liệu |
|---|---|---|
| 1 | Authentication, đăng ký — UC-01, UC-02 | [stage-1-auth-uc01-02.md](stage-1-auth-uc01-02.md) |
| 2 | Tài khoản, lớp, hồ sơ trẻ — UC-03, UC-05, UC-04 | [stage-2-uc03-05.md](stage-2-uc03-05.md) |
| 3 | Điểm danh, dashboard phụ huynh, nghỉ học — UC-06–08 | [stage-3-attendance-uc06-08.md](stage-3-attendance-uc06-08.md) |
| 4 | Hồ sơ sức khỏe — UC-09 | [stage-4-health-uc09.md](stage-4-health-uc09.md) |
| 5 | Hoạt động và đón trẻ — UC-10–12 | [stage-5-activity-pickup-uc10-12.md](stage-5-activity-pickup-uc10-12.md) |
| 6 | Thông báo và báo cáo — UC-13–15 | [stage-6-notification-reporting-uc13-15.md](stage-6-notification-reporting-uc13-15.md) |
| 7 | Kiểm thử, ổn định, triển khai | [stage-7-testing-deployment.md](stage-7-testing-deployment.md) |


## Trạng thái repo hiện tại

- **Stage 1 — Đang hoàn thiện:** login, JWT/Admin guards, đăng ký/duyệt và UI cơ bản đã có; logout/revocation và đồng bộ OpenAPI-flow đăng ký còn cần chốt.
- **Stage 2 — Đang triển khai:** User entity/profile migration, chuyển User ID sang UUID và auth nền đã có; API quản trị, audit log, lớp và trẻ chưa có. Cần xác nhận trạng thái migration trên DB.
- **Stage 3–6 — Chưa bắt đầu:** chưa có module nghiệp vụ tương ứng trong backend.
- **Stage 7 — Hạ tầng một phần đã có:** Dockerfiles, Compose và CI workflow tồn tại; backend test scripts/backend `.dockerignore` còn thiếu, CI chưa được xác nhận chạy xanh.

Trạng thái này phản ánh file hiện có trong repository; migration cần được đối chiếu với database đang chạy trước khi xem là đã áp dụng.

Danh mục use case: [docs/01-requirements/use-cases/README.md](../01-requirements/use-cases/README.md).

> Thứ tự là đề xuất triển khai cho MVP. Các chức năng nhạy cảm (đặc biệt sức khỏe, người đón và quyền xem dữ liệu trẻ) cần được rà soát cùng nhóm trước khi đưa lên môi trường dùng chung.
