# Hướng dẫn chạy frontend với backend local

Tài liệu này dành cho thành viên phát triển KidCare. Mỗi người chạy frontend, backend và PostgreSQL trên máy riêng; mock data trên trình duyệt không tự đồng bộ với thành viên khác.

## 1. Hai chế độ của frontend

Frontend đọc `frontend/.env.local` khi Vite khởi động. Sau khi đổi biến, hãy dừng Vite bằng `Ctrl+C` rồi chạy lại `npm run dev`.

### Dùng mock trong trình duyệt

```ini
VITE_USE_MOCK=true
VITE_API_URL=http://localhost:3000
```

Đăng nhập demo bằng `admin@demo.com` / `Password@123`. API và phiên đăng nhập dùng mock data trong `localStorage`; backend/PostgreSQL không được gọi.

### Dùng backend thật

```ini
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:3000
```

Login gọi `POST /auth/login`; các hàm API trong `frontend/src/services/http.js` gọi backend và gửi JWT bằng header `Authorization: Bearer ...`. Tài khoản phải tồn tại trong PostgreSQL.

Chế độ này áp dụng cho **mọi** request dùng `http.js`. Backend hiện triển khai phần xác thực và Stage 2 (users, audit logs, classes, children); các màn hình stage khác có thể chưa có API. Ví dụ, NotificationBell gọi `/notifications/unread-count`, endpoint hiện chưa có backend implementation nên có thể nhận `404`.

## 2. Cấu hình backend local

Tạo `backend/.env` riêng trên máy. Repo hiện không có `backend/.env.example`; tối thiểu cần cấu hình:

```ini
PORT=3000
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=user
DB_PASSWORD=password
DB_DATABASE=mydb
JWT_SECRET=thay-bang-secret-ngau-nhien-danh-rieng-cho-may-local
```

`DB_PORT=5433` là cổng host được ánh xạ trong `docker-compose.yml` (`5433:5432`). PostgreSQL bên trong container vẫn dùng cổng `5432`. Không commit `backend/.env` hoặc secret thật.

## 3. Khởi động PostgreSQL, backend và frontend

Yêu cầu Node.js 20, npm và Docker Desktop đang chạy.

### Terminal 1 — PostgreSQL

Từ thư mục gốc repository:

```powershell
docker compose up -d db
docker compose ps
```

Chờ service `db` ở trạng thái chạy/healthy.

### Terminal 2 — backend

```powershell
cd backend
npm ci
npx typeorm-ts-node-commonjs -d src/database/data-source.ts migration:show
```

Xem migration nào còn chờ. Trên database local mới, sau khi đã review danh sách migration:

```powershell
npm run migration:run
npm run start:dev
```

Giữ terminal backend mở. Backend dùng `backend/.env` để đọc PostgreSQL và `JWT_SECRET`.

Kiểm tra:

- <http://localhost:3000/health> — backend đang chạy.
- <http://localhost:3000/health/ready> — backend kết nối được PostgreSQL.
- <http://localhost:3000/docs> — Swagger.

Không chạy migration mù quáng trên database đang có dữ liệu. Nếu `ChangeUserIdToUuid` hoặc migration cũ khác đang pending, kiểm tra trạng thái và backup trước khi áp dụng.

### Terminal 3 — frontend

Trong `frontend/.env.local`, chọn một chế độ ở mục 1. Sau đó:

```powershell
cd frontend
npm ci
npm run dev
```

Mở địa chỉ Vite in trong terminal, mặc định <http://localhost:5173>. CORS backend hiện cho phép đúng origin `http://localhost:5173`; dùng `localhost`, không đổi thành `127.0.0.1` nếu chưa cập nhật CORS.

## 4. Xuất mock data từ trình duyệt

Importer cần snapshot runtime của mock DB để giữ nguyên UUID và các liên kết giữa user, lớp, trẻ. `mockDB.js` có seed ban đầu, nhưng UUID được tạo lúc chạy và các thao tác mock sau đó lưu vào `localStorage`.

1. Đặt `VITE_USE_MOCK=true`, khởi động lại Vite, mở ứng dụng và đăng nhập demo một lần để khởi tạo mock DB.
2. Mở DevTools bằng `F12` → **Console**, chạy:

   ```js
   localStorage.getItem('kidcare.mockdb.v4')?.length
   ```

   Lệnh này cần trả về một số lớn hơn 0.
3. Copy snapshot:

   ```js
   copy(localStorage.getItem('kidcare.mockdb.v4'))
   ```

   DevTools có thể hiện `undefined` vì `copy()` không trả kết quả; dữ liệu vẫn được chép vào clipboard.
4. Tạo `mock-data.json` ở thư mục gốc repository, dán clipboard vào và lưu. File này đã được Git ignore; không commit file này.

## 5. Import mock frontend vào PostgreSQL

Khởi động PostgreSQL local bằng Docker, cấu hình `backend/.env` trỏ tới database đó (Compose publish cổng host `5433`), rồi chạy các migration cần thiết trước. Từ thư mục `backend`, chạy:

```powershell
npm run db:import-mock -- ../mock-data.json --confirm
```

Importer đọc snapshot frontend trong `mock-data.json` ở thư mục gốc và nhập dữ liệu theo thứ tự khóa ngoại, bên trong một transaction: users (mật khẩu được hash lại bằng Argon2), classes, children, liên kết phụ huynh/giáo viên, attendance, leave requests, health records, allergies, conditions, vaccinations, medical visits, activities, participants, images, pickup requests và notifications. Các mảng tùy chọn không có trong snapshot sẽ được bỏ qua. Ảnh hoạt động (nếu có) được lưu trong `backend/uploads/activities` hoặc `ACTIVITY_UPLOAD_DIR`.

Script không truncate hoặc xóa dữ liệu trong database. Chạy lại sẽ cập nhật bản ghi theo UUID, email user, hoặc tên lớp/năm học. Chỉ dùng với database local/test, không dùng database chung hay production. Thiếu ID được tham chiếu hoặc chưa chạy migration sẽ khiến transaction rollback. Snapshot frontend không có audit logs; backend tiếp tục tạo log khi có thao tác qua API. User demo dùng mật khẩu `Password@123`.

Sau khi import, đặt `VITE_USE_MOCK=false`, khởi động lại Vite và đăng nhập bằng user đã import để thử frontend với backend. Mở `/admin/users` để thử quản lý user; Manager có thể thử `/manager/classes` và các trang trẻ nếu đã được nối API.

## 6. Lỗi thường gặp

| Triệu chứng | Ý nghĩa / kiểm tra |
|---|---|
| `ERR_CONNECTION_REFUSED` tới `localhost:3000` | Backend không chạy hoặc dùng cổng khác. Chạy `npm run start:dev` trong `backend` và kiểm tra `/health`. |
| `/health` chạy nhưng `/health/ready` lỗi | PostgreSQL chưa chạy, hoặc `DB_HOST`/`DB_PORT`/credentials trong `backend/.env` không khớp. Với Compose hiện tại, host port là `5433`. |
| CORS báo credentials/header/origin | Dùng đúng `http://localhost:5173`. Frontend JWT Bearer không cần cookie credentials; không thêm `credentials: 'include'` nếu chưa chuyển auth sang cookie. |
| `401` ở `/auth/login` | Backend đã nhận request nhưng email/mật khẩu không đúng hoặc user chưa import/active. |
| `401` hoặc `403` ở API | Kiểm tra JWT phiên hiện tại, role và status tài khoản. Đăng nhập lại sau khi import. |
| `404` tại `/notifications/unread-count` hoặc API Stage khác | Endpoint đó chưa được triển khai trong backend; đây không phải lỗi kết nối. Dùng mock mode cho phần đó hoặc chờ backend implementation. |
| Audit log rỗng | Importer không chuyển audit logs mock. Thực hiện mutation qua API backend; giao diện hiện lọc 30 ngày gần nhất. |
