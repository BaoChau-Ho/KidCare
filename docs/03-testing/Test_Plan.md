# Kế hoạch kiểm thử — KidCare

| | |
|---|---|
| Người phụ trách | Vai E (Kiểm thử và vận hành) |
| Phiên bản | 0.1 (Increment 0, tuần 1–2) |
| Trạng thái | Bản nháp, cần cả nhóm xác nhận |

> Các ngưỡng đánh dấu **(đề xuất)** là gợi ý của vai E, chưa có trong kế hoạch gốc. Nhóm cần thống nhất trước khi áp dụng.

## 1. Mục tiêu

- Chứng minh phần mềm chạy đúng theo yêu cầu (FR) và đạt các tiêu chí phi chức năng (NFR).
- Chặn lỗi nghiêm trọng về **phân quyền và rò rỉ dữ liệu trẻ em** (IDOR) trước khi giao từng Increment.
- Phát hiện sớm việc tính năng mới làm hỏng tính năng cũ (regression).

## 2. Phạm vi

**Trong phạm vi:** các module Auth, Users, Children/Parents/Teachers/Classes, Attendance (kèm đơn xin nghỉ), Health, Activities, Notifications. Các tính năng Must và Should.

**Ngoài phạm vi (trừ khi làm ở tuần 11):** Pickup, Reporting, kênh thông báo Email/SMS/Push, kiểm thử tải quy mô hàng trăm nghìn người dùng.

## 3. Các mức kiểm thử

| Mức | Kiểm tra gì | Công cụ | Ai viết chính | Chạy ở đâu |
|---|---|---|---|---|
| Unit | Một hàm riêng lẻ (tính trạng thái LATE, kiểm tra sở hữu, hash mật khẩu) | Jest | Người viết code (C, B), E hỗ trợ | CI, mỗi PR |
| Integration | Nhiều phần phối hợp với database thật (tạo trẻ + gắn phụ huynh trong một transaction) | Jest + Postgres thật | E, C | CI, mỗi PR |
| API | Gọi API và xem mã trả về (401, 403, 400, 200) | Supertest | E | CI, mỗi PR |
| E2E | Mô phỏng người dùng bấm trên giao diện từ đầu đến cuối | Playwright (hoặc Cypress) | E | CI trước merge vào `main`; chạy tay khi cần |
| Bảo mật | IDOR, brute force, input lạ, token giả/hết hạn | Supertest + kiểm tra tay | E | Mỗi Increment; tổng thể ở tuần 11 |
| Hiệu năng | Thời gian phản hồi API với dữ liệu mẫu lớn | k6 hoặc autocannon **(đề xuất)** | E | Tuần 7–8, tuần 11 |
| Regression | Chạy lại toàn bộ test của các Increment trước | Toàn bộ bộ test ở trên | E | Cuối mỗi Increment |

## 4. Quy ước đặt mã

- Test case: `TC-<MODULE>-<số>` (ví dụ `TC-AUTH-01`, `TC-ATT-04`). Module theo mã FR: `AUTH`, `CORE`, `ATT`, `HEA`, `ACT`, `NOT`, `SEC`, `PERF`.
- Mỗi test case ghi mã FR hoặc NFR mà nó kiểm tra, để cập nhật được [bảng truy vết](../01-requirements/Traceability_Matrix.md).
- Tên file test gắn Increment để chạy regression: ví dụ `inc1-auth.e2e-spec.ts`. (Thống nhất với vai B, C khi dựng NestJS.)
- Mẫu viết test case: [Test_Case_Template.md](Test_Case_Template.md). Mẫu báo lỗi: `.github/ISSUE_TEMPLATE/bug_report.md`.

## 5. Mức độ nghiêm trọng của lỗi

| Mức | Định nghĩa | Ví dụ KidCare | Xử lý |
|---|---|---|---|
| Critical | Mất/lộ dữ liệu, bỏ qua phân quyền, hệ thống không chạy | Phụ huynh A xem được hồ sơ sức khỏe con của B | Sửa ngay, chặn merge và chặn demo |
| Major | Tính năng chính hỏng, không có cách tránh | Điểm danh tạo bản ghi trùng | Sửa trước khi đóng Increment |
| Minor | Tính năng phụ lỗi, có cách tránh | Bộ lọc danh sách trả sai thứ tự | Sửa nếu còn thời gian trong Increment |
| Trivial | Giao diện, chính tả | Sai nhãn nút | Ghi nhận, sửa khi rảnh |

## 6. Dữ liệu kiểm thử (seed)

Dữ liệu mẫu nạp bằng một lệnh, tăng dần theo Increment (phối hợp với vai C):

| Increment | Dữ liệu mẫu |
|---|---|
| 1 | 1 admin, 1 manager, 2 giáo viên, 1 nhân viên y tế, 2 phụ huynh |
| 2 | 2 lớp, 8–10 trẻ, mỗi trẻ 1–2 phụ huynh; có ít nhất 1 giáo viên **không** thuộc lớp nào để test quyền |
| 3 | Khoảng 10.000 bản ghi điểm danh để đo hiệu năng API "hôm nay" |
| 4 | Hồ sơ sức khỏe, tiêm chủng mẫu, ít nhất 1 trẻ có dị ứng |

Dữ liệu seed là dữ liệu giả. **Không** dùng dữ liệu thật của trẻ.

## 7. Môi trường

| Môi trường | Dùng để | Cách chạy |
|---|---|---|
| Local | Dev và test hằng ngày | `docker compose up` |
| CI (GitHub Actions) | Chặn merge nếu lint/test/build lỗi | Tự chạy trên mỗi Pull Request |
| Deploy (tuần 11) | Kiểm thử cuối và demo | VPS hoặc Render/Railway, có HTTPS |
| Dự phòng demo | Phòng khi mạng hoặc deploy hỏng | `docker compose up` + seed trên máy cá nhân |

## 8. Điều kiện bắt đầu và kết thúc

**Bắt đầu kiểm thử một Increment khi:** use case và danh sách API (`openapi.yaml`) đã viết; code đã merge vào `develop`; chạy được bằng `docker compose up`.

**Đóng một Increment khi (checklist trong kế hoạch gốc):**
- Test tự động của Increment đạt, **regression** các Increment trước đạt.
- Không còn lỗi Critical/Major mở.
- Bảng truy vết đã cập nhật; demo nội bộ và retrospective xong; đã gắn tag phiên bản.

**Phát hành v1.0 khi:**
- Mọi FR mức Must có use case, thiết kế, API và test case.
- Không còn lỗi Critical/Major mở.
- CI xanh trên `main`.
- Đã test IDOR trên **mọi** API có `:id`.
- Đã kiểm tra backup và khôi phục database thật.
- Tỷ lệ test đạt ≥ 95% **(đề xuất)**.

## 9. Chiến lược regression

- Mọi test tự động nằm trong CI, chạy trên mỗi Pull Request. Không chạy regression bằng tay.
- Cuối mỗi Increment chạy lại toàn bộ test của các Increment trước và ghi kết quả vào biên bản retrospective.
- Gắn nhãn Increment trong tên test để lọc nhanh khi cần.
- Khi sửa lỗi, thêm một test tái hiện lỗi đó để lỗi không quay lại.

## 10. Lịch kiểm thử theo tuần

| Tuần | Việc của vai E |
|---|---|
| 1–2 | Dựng repo, Docker Compose, CI, Prettier; viết kế hoạch test (tài liệu này), tiêu chí NFR; mẫu test case, mẫu báo lỗi |
| 3–4 | Test case và test phân quyền cho auth (401/403), rate limit đăng nhập, input lạ, E2E đăng nhập 5 vai trò |
| 5–6 | Test IDOR, test hàm sở hữu, test transaction, E2E tiếp nhận trẻ, regression Inc 1 |
| 7–8 | Test trạng thái điểm danh (biên), test đồng thời không tạo bản ghi trùng, đo hiệu năng 10.000 bản ghi, regression Inc 1–2 |
| 9 | Test giá trị hợp lệ, lọc theo vai trò, audit log, regression Inc 1–3 |
| 10 | Test người nhận thông báo, luồng sự kiện, upload, E2E xuyên suốt, regression Inc 1–4 |
| 11 | Kiểm thử tổng thể, bảo mật, đối chiếu NFR, kiểm thử chéo, Test Report; deploy, backup/restore |
| 12 | Hoàn thiện tài liệu test, bảng truy vết, hướng dẫn cài đặt; tag v1.0, tập dượt |

## 11. Rủi ro kiểm thử

| Rủi ro | Ảnh hưởng | Cách giảm thiểu |
|---|---|---|
| Quên kiểm tra quyền ở một API | Lộ dữ liệu trẻ | Mặc định từ chối; test phân quyền theo bảng API × vai trò; test IDOR bắt buộc cho mọi API `:id` |
| Hai giáo viên điểm danh cùng lúc | Bản ghi trùng | Ràng buộc duy nhất (trẻ, ngày) ở database + test đồng thời |
| Vai E quá tải ở tuần 7–8 và 11 | Trễ test | Vai C tự viết test phần mình; E viết test xuyên module; ưu tiên cắt theo thứ tự trong mục 13 của kế hoạch gốc, **không** cắt test của phần bắt buộc |
| Dữ liệu sức khỏe lọt vào log | Lộ dữ liệu nhạy cảm | Kiểm tra log khi test Increment 4; chặn log trường sức khỏe |
| Tài liệu và code lệch nhau | Báo cáo sai | Đối chiếu bảng truy vết cuối mỗi Increment |
| Demo hỏng do mạng/deploy | Mất điểm | Bản dự phòng `docker compose up` + video demo |

## 12. Việc cần nhóm quyết định

- Chọn Playwright hay Cypress cho E2E (đề xuất Playwright).
- Chọn công cụ đo hiệu năng (đề xuất k6 hoặc autocannon).
- Xác nhận các ngưỡng đánh dấu **(đề xuất)** ở trên.
- Thống nhất cách đặt tên file test theo Increment với vai B và C.
