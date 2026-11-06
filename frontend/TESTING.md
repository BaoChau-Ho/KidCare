# Kiểm thử frontend — KidCare

Cập nhật lần cuối: **06/11/2026**, trên `main` tại commit `a3eba22`.

## Tổng quan

| File | Kiểm tra gì | Số test | Trong đó lỗi đã biết |
|---|---|---|---|
| `src/flows.test.jsx` | Giao diện giai đoạn 3–6 trên mock server (UC-06 → 15), chặn route | 15 | 0 |
| `src/services/mockServer.test.js` | Logic nghiệp vụ của mock server giai đoạn 3–6 | 29 | 0 |
| `src/flows-stage-1-2.test.jsx` | Giao diện giai đoạn 1–2 trên mock server: đăng nhập, đăng ký + duyệt, tài khoản, lớp, hồ sơ trẻ | 17 | 0 |
| `src/backendShape.test.jsx` | Giao diện giai đoạn 2 khi nhận dữ liệu đúng dạng backend thật | 6 | 2 (F3, F4) |
| `src/services/http.test.js` | `http.js` và `auth.js` khi tắt mock (`VITE_USE_MOCK=false`) | 19 | 3 (F2) |
| `src/contract.test.js` | Khớp nối frontend ↔ backend ↔ `openapi.yaml`, nhãn audit log | 6 | 0 (lệch được liệt kê trong file) |
| `src/services/mockContract.test.js` | Dữ liệu mock server trả về khớp schema trong `openapi.yaml` | 3 | 0 (lệch được liệt kê trong file) |
| `src/sum.test.ts` | Test mẫu | 1 | 0 |
| **Tổng** | | **96** | **5** |

- **Lỗi đã biết:** test viết bằng `it.fails` mô tả hành vi đúng nhưng code hiện còn sai; test "đạt" khi lỗi còn tồn tại. Sửa xong thì đổi `it.fails` thành `it`.
- **Danh sách lệch đã biết** (`KNOWN_MISMATCHES` trong `contract.test.js`, `KNOWN` trong `mockContract.test.js`): CI xanh với các chỗ lệch hiện có, nhưng đỏ ngay khi có chỗ lệch mới. Sửa xong một chỗ lệch thì xóa dòng tương ứng; test CT-05 / MC-03 sẽ nhắc nếu quên.

## Vì sao có 3 loại test

Giao diện mặc định chạy trên **mock server** (`services/mockServer.js`, dữ liệu trong localStorage). Test trên mock chỉ chứng minh giao diện đúng với mock. Khi chuyển sang backend thật, lỗi có thể đến từ 3 chỗ, mỗi chỗ có một loại test:

1. Frontend gọi API mà backend không có, hoặc backend có API mà đặc tả không ghi: `contract.test.js`.
2. Mock trả dữ liệu khác dạng với backend thật: `mockContract.test.js` (so mock với `openapi.yaml`) và `backendShape.test.jsx` (cho giao diện chạy với dữ liệu đúng dạng backend).
3. Lớp gọi mạng (`http.js`, đăng nhập trong `auth.js`) xử lý sai token, lỗi, mất mạng: `http.test.js`.

## Cách chạy

```bash
cd frontend
npm test                                      # toàn bộ
npx vitest run src/contract.test.js           # chỉ khớp nối
npx vitest run -t "UI-"                       # chỉ test giao diện giai đoạn 1–2
```

`contract.test.js` và `mockContract.test.js` đọc `backend/src` và `docs/02-design/openapi.yaml`, nên phải chạy trong repo đầy đủ (CI checkout cả repo nên chạy được).

## Vấn đề phát hiện

| # | Vấn đề | Test | Mức độ | Trạng thái |
|---|---|---|---|---|
| F1 | Trang giáo viên Hoạt động và Gửi thông báo gọi `GET /classes/{id}/children`; backend và `openapi.yaml` đều không có (backend dùng `GET /children?classId=`). Khi tắt mock, 2 trang này nhận 404 | CT-02, CT-03 | Major | Mở |
| F2 | Khi tắt mock, chỉ đăng nhập gọi backend. Đăng ký, danh sách chờ duyệt, duyệt, từ chối vẫn chạy trên localStorage; `registerRequest` không nhận mật khẩu dù `POST /auth/register` bắt buộc. Quên / đổi mật khẩu: backend chưa có API | HTTP-15 → 17 | Major | Mở |
| F3 | Hộp thoại phân công giáo viên so sánh theo `t.userId` (dạng của mock); backend trả `t.id`. Khi nối backend, giáo viên đang dạy hiện 2 lần, một lần bị gắn "Đã khóa" | BS-02 | Major | Mở |
| F4 | `ACTION_LABELS` thiếu `CHANGE_USER_ROLE`, `CHANGE_USER_STATUS`, `WITHDRAW_CHILD` của backend; nhật ký thao tác hiện mã tiếng Anh | BS-04, CT-06 | Minor | Mở |
| F5 | Mock trả 17 trường lệch `openapi.yaml`: giáo viên của lớp (`userId` thay vì `id`), phụ huynh của trẻ (`userId`, `email`, `phone` thay vì `parentUserId`), thiếu `parents` ở danh sách trẻ, audit log dùng tên trường riêng. Đây là gốc của F3 | MC-02 | Major | Mở |
| F6 | `openapi.yaml` lệch: ghi đường dẫn duyệt đăng ký là `PATCH /auth/{id}/approve` (backend dùng `/admin/registration-requests/{id}/approve`); thiếu `GET /auth/set-password/check`; chưa có 9 API frontend đang gọi (dị ứng, bệnh nền, hủy đơn nghỉ, đọc tất cả thông báo, `GET /classes/{id}/children`) | CT-02, CT-04 | Minor | Mở |
| F7 | Tab Phụ huynh của hồ sơ trẻ có cột Email, Điện thoại nhưng hợp đồng không trả 2 trường này; khi nối backend 2 cột trống | MC-02 | Minor, cần nhóm chốt | Mở |
| F8 | Mock phân quyền khác backend: cho nhân viên y tế xem trẻ và lớp (backend 403, xem vấn đề #10 ở `backend/test/README.md`); không cho giáo viên xem danh sách trẻ (backend cho); phụ huynh xem trẻ khác nhận 404 (backend 403) | Chưa có test tự động | Minor | Mở |

## Lịch sử cập nhật

| Ngày | Nội dung |
|---|---|
| 06/11/2026 | Thêm 51 test: khớp nối frontend ↔ backend ↔ openapi, `http.js` khi tắt mock, mock so với hợp đồng, giao diện với dữ liệu backend, giao diện giai đoạn 1–2; ghi nhận F1–F8 |
