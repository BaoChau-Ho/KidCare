# Bảng truy vết — KidCare

Đọc từ trái sang phải: yêu cầu nào → use case nào → thiết kế → API nào → test nào → xong chưa. Mục đích là chứng minh không sót yêu cầu nào và không có code thừa không ai yêu cầu.

> Vai A giữ bảng chuẩn và cập nhật yêu cầu, use case. Vai E cập nhật cột test case và trạng thái. Đối chiếu cuối mỗi Increment.

**Quy ước mã:** FR (yêu cầu chức năng), NFR (phi chức năng), UC (use case), SEQ/ACT/CLS (sơ đồ Sequence/Activity/Class), TC (test case). Theo sau là tên module và số thứ tự.

**Trạng thái:** Chưa / Đang làm / Xong.

## Yêu cầu chức năng

Các dòng dưới đây là **ví dụ lấy từ kế hoạch** (mục "Bước 3 — Viết danh sách yêu cầu chức năng"). Danh sách đầy đủ do vai A hoàn thiện ở Increment 0.

| FR | Mô tả | Ưu tiên | Inc | Use case | Thiết kế | API | Test case | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| FR-AUTH-01 | Người dùng đăng nhập bằng email và mật khẩu | Must | 1 | UC-AUTH-02 | SEQ-AUTH-01 | `POST /auth/login` | TC-AUTH-… | Chưa |
| FR-AUTH-02 | Mỗi vai trò chỉ dùng được chức năng của vai trò đó | Must | 1 | | | | TC-AUTH-… | Chưa |
| FR-CORE-01 | Quản lý tạo lớp và xếp trẻ vào lớp | Must | 2 | | | `POST /classes`, `POST /children` | TC-CORE-… | Chưa |
| FR-ATT-01 | Giáo viên điểm danh trẻ (có mặt, vắng, muộn) | Must | 3 | UC-ATT-02 | SEQ-ATT-01 | `POST /attendance/check-in` | TC-ATT-… | Chưa |
| FR-ATT-02 | Phụ huynh xem con hôm nay đã đến trường chưa | Must | 3 | | | `GET /children/:id/attendance/today` | TC-ATT-… | Chưa |
| FR-HEA-01 | Nhân viên y tế ghi chiều cao, cân nặng, dị ứng của trẻ | Must | 4 | UC-HEA-02 | CLS-HEA-01 | `POST /children/:id/health-records` | TC-HEA-… | Chưa |
| FR-NOT-01 | Khi trẻ được điểm danh, phụ huynh nhận thông báo | Should | 5 | | | | TC-NOT-… | Chưa |
| FR-REP-01 | Quản lý xem báo cáo chuyên cần theo lớp | Could | Tùy chọn | | | `GET /reports/attendance` | | Chưa |

## Yêu cầu phi chức năng

Chi tiết cách kiểm tra xem [NFR.md](NFR.md).

| NFR | Mô tả ngắn | Cách kiểm tra | Test case | Trạng thái |
|---|---|---|---|---|
| NFR-SEC-01 | Mật khẩu được mã hóa | Xem bảng `users` | TC-SEC-… | Chưa |
| NFR-SEC-02 | Không có IDOR | Đổi id → 403 | TC-SEC-… | Chưa |
| NFR-PERF-01 | API dưới 500 ms | Đo với 10.000 bản ghi | TC-PERF-… | Chưa |
| NFR-REL-01 | Có backup và khôi phục được | Thử khôi phục | TC-REL-… | Chưa |
| NFR-MNT-01 | Code chia module, có Swagger và test tự động | Xem repo, Swagger, CI | — | Chưa |

## Kiểm tra cuối mỗi Increment

- [ ] Mọi FR Must của Increment có use case, thiết kế, API và test case.
- [ ] Mỗi test case có mã FR hoặc NFR tương ứng.
- [ ] Không có API nào ngoài `openapi.yaml`, và mọi API trong `openapi.yaml` có test.
- [ ] Trạng thái khớp với thực tế trên nhánh `develop`.
