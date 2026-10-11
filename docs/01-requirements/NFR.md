# Yêu cầu phi chức năng (NFR) — KidCare

> Soạn bởi vai E phối hợp với vai A. **Dựa trên bài toán giả định** (không có khách hàng thật). Vai A giữ bản chuẩn; mọi thay đổi phải được cả nhóm đồng ý.

Nguyên tắc: chỉ ghi những gì **kiểm tra được**. "Phần mềm phải nhanh" là chưa đủ; "API thông thường trả lời dưới 500 ms" mới đủ.

Cột "Nguồn": **Kế hoạch** = có sẵn trong kế hoạch dự án; **Đề xuất** = vai E bổ sung, cần nhóm xác nhận.

## Bảo mật

| Mã | Yêu cầu | Cách kiểm tra | Công cụ | Test case | Kiểm ở | Nguồn |
|---|---|---|---|---|---|---|
| NFR-SEC-01 | Mật khẩu lưu dạng đã mã hóa (bcrypt/argon2), không lưu nguyên văn | Xem bảng `users` trong database: không có mật khẩu rõ | SQL + test tích hợp | TC-SEC-… | Inc 1, tuần 11 | Kế hoạch |
| NFR-SEC-02 | Người dùng chỉ xem được dữ liệu của mình (không IDOR) | Đổi `id` trên đường dẫn sang dữ liệu người khác → phải nhận 403 | Supertest + kiểm tra tay | TC-SEC-… | Inc 2–5, tuần 11 | Kế hoạch |
| NFR-SEC-03 | Giới hạn số lần đăng nhập sai (5 lần/phút) | Gửi liên tục yêu cầu đăng nhập sai → từ lần thứ 6 bị chặn (429 hoặc tương đương) | Supertest | TC-SEC-… | Inc 1 | Kế hoạch (mục 5) |
| NFR-SEC-04 | Access token hết hạn sau ~15 phút; token hết hạn hoặc giả mạo bị từ chối (401) | Dùng token hết hạn và token sửa tay | Supertest | TC-SEC-… | Inc 1, tuần 11 | Kế hoạch |
| NFR-SEC-05 | Mọi API mặc định từ chối; API chưa khai báo vai trò không cho qua | Quét danh sách endpoint, đối chiếu với bảng API × vai trò | Test tự động duyệt route | TC-SEC-… | Mỗi Inc | Kế hoạch (Guard) |
| NFR-SEC-06 | Dữ liệu đầu vào được kiểm tra (email hợp lệ, mật khẩu đủ mạnh, ký tự lạ không gây lỗi 500) | Gửi dữ liệu sai định dạng, quá dài, ký tự đặc biệt → trả 400, không crash | Supertest | TC-SEC-… | Mỗi Inc | Kế hoạch |
| NFR-SEC-07 | Không lộ mật khẩu, khóa bí mật hoặc thông tin lỗi nội bộ trong response và log; không ghi chi tiết sức khỏe vào log | Xem response lỗi và log khi test | Kiểm tra tay + grep log | TC-SEC-… | Inc 4, tuần 11 | Kế hoạch |
| NFR-SEC-08 | Thao tác quan trọng được ghi audit log (ai, làm gì, giá trị cũ/mới, IP) | Thực hiện thao tác → kiểm tra bản ghi `audit_logs` | Test tích hợp | TC-SEC-… | Inc 1, 2, 4 | Kế hoạch |
| NFR-SEC-09 | Bản deploy dùng HTTPS | Truy cập bằng `https://`, `http://` được chuyển hướng hoặc chặn | Trình duyệt, curl | TC-SEC-… | Tuần 11 | Kế hoạch (mục 27) |

## Hiệu năng

| Mã | Yêu cầu | Cách kiểm tra | Công cụ | Test case | Kiểm ở | Nguồn |
|---|---|---|---|---|---|---|
| NFR-PERF-01 | API thông thường trả lời dưới 500 ms | Đo với dữ liệu mẫu lớn (khoảng 10.000 bản ghi điểm danh), lấy thời gian trả lời (đề xuất đo p95) | k6 / autocannon (đề xuất) | TC-PERF-… | Inc 3, tuần 11 | Kế hoạch |
| NFR-PERF-02 | Mọi danh sách có phân trang | Gọi API danh sách với dữ liệu lớn → số bản ghi trả về bị giới hạn theo trang | Supertest | TC-PERF-… | Mỗi Inc | Kế hoạch |
| NFR-PERF-03 | Truy vấn "hôm nay" của điểm danh có chỉ mục (index) | Kiểm tra index trong migration và kế hoạch truy vấn | SQL `EXPLAIN` | TC-PERF-… | Inc 3 | Kế hoạch |

## Độ tin cậy

| Mã | Yêu cầu | Cách kiểm tra | Công cụ | Test case | Kiểm ở | Nguồn |
|---|---|---|---|---|---|---|
| NFR-REL-01 | Không mất dữ liệu điểm danh; có backup database | Tạo backup, xóa dữ liệu thử, **khôi phục** và đối chiếu | Script backup/restore | TC-REL-… | Tuần 11 | Kế hoạch |
| NFR-REL-02 | Nghiệp vụ quan trọng chạy trong transaction | Gây lỗi giữa chừng khi tạo trẻ + gắn phụ huynh → không còn dữ liệu dở dang | Test tích hợp | TC-REL-… | Inc 2, 3 | Kế hoạch |
| NFR-REL-03 | Không tạo bản ghi điểm danh trùng (trẻ, ngày), kể cả khi gửi đồng thời | Gửi 2 yêu cầu song song → chỉ 1 bản ghi | Test đồng thời + ràng buộc DB | TC-REL-… | Inc 3 | Kế hoạch |

## Khả năng bảo trì

| Mã | Yêu cầu | Cách kiểm tra | Công cụ | Test case | Kiểm ở | Nguồn |
|---|---|---|---|---|---|---|
| NFR-MNT-01 | Code chia module; có tài liệu API (Swagger) và test tự động | Xem cấu trúc repo, trang Swagger, CI chạy test | Kiểm tra tay, CI | — | Tuần 1–2, tuần 11 | Kế hoạch |
| NFR-MNT-02 | Thay đổi database luôn qua migration | Không có thay đổi schema ngoài thư mục migration | Review PR | — | Mỗi Inc | Kế hoạch |
| NFR-MNT-03 | Chạy được bằng một lệnh `docker compose up` | Clone mới, copy `.env.example`, chạy lệnh | Kiểm tra tay | — | Tuần 1–2, mỗi Inc | Kế hoạch |

## Việc cần chốt

- Vai A xác nhận các dòng "Đề xuất" và mã yêu cầu cuối cùng.
- Nhóm quyết định đo hiệu năng bằng giá trị nào (trung bình hay p95) và trên máy nào, để kết quả so sánh được.
- Sau khi có test case thật, điền mã `TC-…` vào cột "Test case" và cập nhật [bảng truy vết](Traceability_Matrix.md).
