# Mẫu Test Case — KidCare

Mỗi test case nên đủ rõ để người khác chạy lại mà không phải hỏi. Sao chép mẫu bên dưới cho từng test case, hoặc gom vào một bảng theo module.

## Mẫu một test case

| Mục | Nội dung |
|---|---|
| Mã | `TC-<MODULE>-<số>` |
| Tên | Mô tả ngắn điều được kiểm tra |
| Yêu cầu liên quan | FR-/NFR- (và UC- nếu có) |
| Mức | Unit / Integration / API / E2E / Bảo mật / Hiệu năng |
| Increment | 1 / 2 / 3 / 4 / 5 |
| Độ ưu tiên | High / Medium / Low |
| Điều kiện trước | Dữ liệu, tài khoản, trạng thái cần có |
| Các bước | 1. … 2. … 3. … |
| Dữ liệu vào | Giá trị cụ thể dùng trong test |
| Kết quả mong đợi | Mã HTTP, dữ liệu trả về, thay đổi trong database, audit log, thông báo… |
| Tự động hóa | Có (đường dẫn file test) / Chưa |
| Kết quả lần chạy gần nhất | Đạt / Không đạt / Chưa chạy — kèm ngày và phiên bản |
| Lỗi liên quan | Số issue nếu không đạt |

## Ví dụ 1 — phân quyền (API)

| Mục | Nội dung |
|---|---|
| Mã | TC-AUTH-05 |
| Tên | Phụ huynh gọi API quản trị bị từ chối |
| Yêu cầu liên quan | FR-AUTH-02, NFR-SEC-02 |
| Mức | API |
| Increment | 1 |
| Độ ưu tiên | High |
| Điều kiện trước | Có tài khoản phụ huynh từ seed; đã đăng nhập, có access token |
| Các bước | 1. Gọi `GET /users` kèm token của phụ huynh |
| Kết quả mong đợi | HTTP 403; không có dữ liệu người dùng trong response |

## Ví dụ 2 — IDOR (bảo mật)

| Mục | Nội dung |
|---|---|
| Mã | TC-SEC-01 |
| Tên | Phụ huynh A không xem được hồ sơ con của phụ huynh B |
| Yêu cầu liên quan | NFR-SEC-02 |
| Mức | Bảo mật / API |
| Increment | 2 |
| Độ ưu tiên | High (Critical nếu lỗi) |
| Điều kiện trước | Phụ huynh A có con id=5; phụ huynh B có con id=6; đã đăng nhập bằng tài khoản A |
| Các bước | 1. Gọi `GET /children/5` → 200. 2. Đổi id, gọi `GET /children/6` |
| Kết quả mong đợi | Bước 2 trả 403; response không chứa thông tin của trẻ id=6 |

## Ví dụ 3 — trường hợp biên (Unit)

| Mục | Nội dung |
|---|---|
| Mã | TC-ATT-01 |
| Tên | Đến đúng giờ chuẩn thì không bị tính MUỘN |
| Yêu cầu liên quan | FR-ATT-01 |
| Mức | Unit |
| Increment | 3 |
| Độ ưu tiên | High |
| Điều kiện trước | Giờ chuẩn cấu hình 08:00 |
| Dữ liệu vào | Giờ đến 08:00, 08:01 |
| Kết quả mong đợi | 08:00 → PRESENT; 08:01 → LATE (theo quy tắc "đến sau giờ chuẩn là muộn"; xác nhận lại quy tắc với vai A) |

## Danh sách kiểm tra khi viết test case

- Có ít nhất một trường hợp **đường đi đúng** và một trường hợp **lỗi** (sai dữ liệu, thiếu quyền).
- Với mọi API: thử **chưa đăng nhập** (401), **sai vai trò** (403), **không phải chủ dữ liệu** (403).
- Với dữ liệu số và ngày: thử giá trị biên, âm, rỗng, quá lớn.
- Với thao tác ghi: kiểm tra audit log nếu là thao tác quan trọng.
- Có mã yêu cầu liên quan để đưa vào bảng truy vết.
