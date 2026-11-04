# Yêu cầu phi chức năng (NFR) — KidCare

> Soạn bởi vai E phối hợp với vai A. **Dựa trên bài toán giả định** (không có khách hàng thật). Vai A giữ bản chuẩn; mọi thay đổi phải được cả nhóm đồng ý.

Nguyên tắc: chỉ ghi những gì **kiểm tra được**. "Phần mềm phải nhanh" là chưa đủ; "API thông thường trả lời dưới 500 ms" mới đủ.

Mã NFR theo tài liệu SRS (`02_SRS.md`), dùng chung với [bảng truy vết](Traceability_Matrix.md).

Cột "Nguồn": **SRS** = yêu cầu có trong SRS; **Kế hoạch** = ngưỡng cụ thể lấy từ kế hoạch dự án; **Đề xuất** = vai E bổ sung, cần nhóm xác nhận.

## Hiệu năng

| Mã | Yêu cầu | Cách kiểm tra | Công cụ | Test case | Kiểm ở | Nguồn |
|---|---|---|---|---|---|---|
| NFR-PERF-01 | API thông thường trả lời dưới 500 ms | Đo với dữ liệu mẫu lớn (khoảng 10.000 bản ghi điểm danh), lấy thời gian trả lời (đề xuất đo p95). Kiểm tra truy vấn "hôm nay" của điểm danh có index bằng `EXPLAIN` | k6 / autocannon (đề xuất), SQL `EXPLAIN` | TC-PERF-01 | Inc 3, tuần 11 | SRS |
| NFR-PERF-02 | Hỗ trợ nhiều request đồng thời | Gửi nhiều request song song vào API thường dùng → không lỗi, thời gian trả lời vẫn đạt NFR-PERF-01 | k6 / autocannon (đề xuất) | TC-PERF-02 | Inc 3, tuần 11 | SRS |
| NFR-PERF-03 | Mọi API danh sách có phân trang | Gọi API danh sách với dữ liệu lớn → số bản ghi trả về bị giới hạn theo trang | Supertest | TC-USER-06, TC-CHILD-08, TC-ATT-07, TC-NOTI-03 | Mỗi Inc | SRS |

## Bảo mật

| Mã | Yêu cầu | Cách kiểm tra | Công cụ | Test case | Kiểm ở | Nguồn |
|---|---|---|---|---|---|---|
| NFR-SEC-01 | Mật khẩu được hash (bcrypt/argon2), không lưu nguyên văn | Xem bảng `users` trong database: không có mật khẩu rõ | SQL + test tích hợp | TC-SEC-02 | Inc 1, tuần 11 | SRS |
| NFR-SEC-02 | Xác thực bằng JWT; access token hết hạn sau ~15 phút | Dùng token hết hạn và token sửa tay → 401 | Supertest | TC-SEC-03, 04 | Inc 1, tuần 11 | SRS, Kế hoạch |
| NFR-SEC-03 | RBAC ở mọi API, theo quyền tối thiểu: mọi API mặc định từ chối; người dùng chỉ xem được dữ liệu của mình (không IDOR) | Sai vai trò → 403. Đổi `id` trên đường dẫn sang dữ liệu người khác → 403. Quét danh sách endpoint, đối chiếu với bảng API × vai trò | Supertest, test tự động duyệt route, kiểm tra tay | TC-AUTH-11, TC-SEC-08, TC-CHILD-07, TC-CLASS-07, TC-ATT-05, 06, TC-HEALTH-08, TC-ACT-02, TC-NOTI-02, 04 | Mỗi Inc, tuần 11 | SRS |
| NFR-SEC-04 | Dữ liệu đầu vào được kiểm tra (email hợp lệ, mật khẩu đủ mạnh, ký tự lạ không gây lỗi 500) | Gửi dữ liệu sai định dạng, quá dài, ký tự đặc biệt → trả 400, không crash | Supertest | TC-SEC-06, TC-AUTH-03, 12 | Mỗi Inc | SRS |
| NFR-SEC-05 | Giới hạn số lần đăng nhập sai (5 lần/phút) | Gửi liên tục yêu cầu đăng nhập sai → từ lần thứ 6 bị chặn (429 hoặc tương đương) | Supertest | TC-SEC-05 | Inc 1 | SRS, Kế hoạch (mục 5) |
| NFR-SEC-06 | Thao tác quan trọng được ghi audit log (ai, làm gì, giá trị cũ/mới, IP) | Thực hiện thao tác → kiểm tra bản ghi `audit_logs` | Test tích hợp | TC-USER-03, TC-HEALTH-06 | Inc 1, 2, 4 | SRS |
| NFR-SEC-07 | Bản deploy dùng HTTPS / TLS | Truy cập bằng `https://`; `http://` được chuyển hướng hoặc chặn | Trình duyệt, curl | TC-SEC-10 | Tuần 11 | SRS, Kế hoạch (mục 27) |
| NFR-SEC-08 | Không trả dữ liệu trẻ vượt mức cần thiết; không lộ mật khẩu, khóa bí mật hoặc lỗi nội bộ trong response | Kiểm tra response theo từng vai trò (ví dụ phụ huynh chỉ nhận trường sức khỏe được phép). Xem response lỗi | Supertest, kiểm tra tay | TC-SEC-01, 07, TC-SYS-03, TC-HEALTH-07 | Inc 2, 4, tuần 11 | SRS |
| NFR-SEC-09 | Lưu trữ và xử lý token an toàn | Dùng refresh token sau khi đăng xuất → 401. Refresh token không lưu dạng rõ trong database (đề xuất) | Supertest, SQL | TC-AUTH-07 | Inc 1 | SRS, Đề xuất |

## Độ tin cậy

| Mã | Yêu cầu | Cách kiểm tra | Công cụ | Test case | Kiểm ở | Nguồn |
|---|---|---|---|---|---|---|
| NFR-REL-01 | Không mất dữ liệu điểm danh; không tạo bản ghi trùng (trẻ, ngày), kể cả khi gửi đồng thời | Gửi 2 yêu cầu điểm danh song song → chỉ 1 bản ghi | Test đồng thời + ràng buộc DB | TC-REL-02 | Inc 3 | SRS |
| NFR-REL-02 | Nghiệp vụ quan trọng chạy trong transaction | Gây lỗi giữa chừng khi tạo trẻ + gắn phụ huynh, hoặc khi hoàn tất đón trẻ + check-out → không còn dữ liệu dở dang | Test tích hợp | TC-REL-01 | Inc 2, 3, 6 | SRS |
| NFR-REL-03 | Có backup database | Tạo backup, xóa dữ liệu thử, **khôi phục** và đối chiếu | Script backup/restore | TC-REL-03 | Tuần 11 | SRS |

## Khả năng mở rộng

| Mã | Yêu cầu | Cách kiểm tra | Công cụ | Test case | Kiểm ở | Nguồn |
|---|---|---|---|---|---|---|
| NFR-SCAL-01 | Kiến trúc cho phép mở rộng dần từ 100 đến 1.000.000 trẻ | Đánh giá trong tài liệu kiến trúc | Review tài liệu | — | Tuần 11 | SRS |
| NFR-SCAL-02 | Module có ranh giới rõ, tách được thành service về sau | Review: module không truy cập trực tiếp bảng của module khác | Review PR | — | Mỗi Inc | SRS |

## Khả năng bảo trì

| Mã | Yêu cầu | Cách kiểm tra | Công cụ | Test case | Kiểm ở | Nguồn |
|---|---|---|---|---|---|---|
| NFR-MAIN-01 | Kiến trúc Modular Monolith, code chia module | Xem cấu trúc thư mục `backend/src` | Kiểm tra tay | — | Tuần 1–2, tuần 11 | SRS |
| NFR-MAIN-02 | Mã nguồn tuân thủ clean code | Lint và Prettier chạy trong CI; review PR | CI, review PR | — | Mỗi Inc | SRS |
| NFR-MAIN-03 | Có tài liệu API | Trang Swagger / `openapi.yaml` đầy đủ | Kiểm tra tay | TC-SYS-04 | Mỗi Inc, tuần 11 | SRS |
| NFR-MAIN-04 | Có kiểm thử tự động | CI chạy unit, integration, E2E trên mỗi PR | CI | — | Mỗi Inc | SRS |
| NFR-MAIN-05 | Có ghi log hệ thống; log không chứa mật khẩu, khóa bí mật, chi tiết sức khỏe | Xem log khi chạy test | Kiểm tra tay + grep log | TC-SEC-09 | Inc 4, tuần 11 | SRS |

## Đề xuất bổ sung (chưa có trong SRS)

Hai yêu cầu dưới đây vai E đã đưa ra từ trước nhưng SRS chưa có. Nếu nhóm đồng ý, vai A thêm vào SRS và cấp mã mới.

| Yêu cầu | Cách kiểm tra | Công cụ | Kiểm ở |
|---|---|---|---|
| Thay đổi database luôn qua migration | Không có thay đổi schema ngoài thư mục migration | Review PR | Mỗi Inc |
| Chạy được bằng một lệnh `docker compose up` | Clone mới, copy `.env.example`, chạy lệnh | Kiểm tra tay | Tuần 1–2, mỗi Inc |

## Việc cần chốt

- Vai A xác nhận các dòng "Đề xuất" và mã yêu cầu cuối cùng.
- Nhóm quyết định đo hiệu năng bằng giá trị nào (trung bình hay p95) và trên máy nào, để kết quả so sánh được.
- Sau khi có test case thật, điền mã `TC-…` vào cột "Test case" và cập nhật [bảng truy vết](Traceability_Matrix.md).
