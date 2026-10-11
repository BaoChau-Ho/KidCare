# KidCare — Child Care Management System

Hệ thống quản lý và chăm sóc trẻ em: quản lý trẻ, phụ huynh, giáo viên, lớp học, điểm danh, sức khỏe, hoạt động và thông báo. Dự án môn Nhập môn Công nghệ phần mềm, làm theo mô hình **Incremental** trong 12 tuần.

Tài liệu kế hoạch: [KidCare_Project_Plan.md](KidCare_Project_Plan.md) (tổng quan kỹ thuật) và [KidCare_Ke_Hoach_De_Hieu.pdf](KidCare_Ke_Hoach_De_Hieu.pdf) (lịch 12 tuần).

## Công nghệ

React + TypeScript + Vite · NestJS + TypeScript · PostgreSQL · Redis · Docker Compose

## Chạy dự án

Yêu cầu: Docker Desktop (đang chạy), Node.js 20+, Git.

```bash
git clone <địa chỉ repo kidcare>
cd kidcare
cp .env.example .env        # sửa giá trị nếu cần; KHÔNG commit file .env
docker compose up           # chạy frontend, backend, PostgreSQL, Redis
```

| Dịch vụ | Địa chỉ |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| Swagger | http://localhost:3000/api (đường dẫn cuối cùng do vai B quyết định) |
| Kiểm tra sống | http://localhost:3000/health |

> **Trạng thái hiện tại (Increment 0):** `backend/` và `frontend/` chưa có dự án (vai B và D sẽ tạo bằng NestJS và Vite). Trong lúc đó chỉ chạy được phần hạ tầng: `docker compose up postgres redis`. Sau khi `backend/package.json` và `frontend/package.json` có mặt, `docker compose up` sẽ chạy đủ.

## Cấu trúc thư mục

```text
docs/
  00-management   Project Charter, biên bản họp, retrospective, rủi ro
  01-requirements Problem Statement, stakeholder, FR, NFR, use case, bảng truy vết
  02-design       Sơ đồ UML, ERD, kiến trúc, openapi.yaml, bản phác giao diện, ADR
  03-testing      Kế hoạch test, test case, báo cáo test
  04-deployment   Hướng dẫn cài đặt và vận hành
  05-user-guide   Hướng dẫn sử dụng theo vai trò
  06-final-report Báo cáo cuối, slide, kịch bản demo
backend/          Code backend (src), migration và seed (database), test (test)
frontend/         Code giao diện
deploy/           Nginx, Docker Compose bản chạy thật, script backup
.github/          CI (workflow), mẫu Pull Request, mẫu báo lỗi
```

## Kiểm thử và chất lượng

- CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) tự chạy trên mỗi Pull Request vào `develop` hoặc `main`: kiểm tra định dạng, kiểm tra `docker-compose`, và lint/test/build cho backend và frontend (tự bỏ qua nếu chưa có dự án).
- Kế hoạch kiểm thử: [docs/03-testing/Test_Plan.md](docs/03-testing/Test_Plan.md).
- Yêu cầu phi chức năng và cách kiểm tra: [docs/01-requirements/NFR.md](docs/01-requirements/NFR.md).
- Định dạng code: `npm install` ở thư mục gốc, rồi `npm run format` (sửa) hoặc `npm run format:check` (chỉ kiểm tra).

## Làm việc nhóm

Quy ước Git, commit, Pull Request và Definition of Done: xem [CONTRIBUTING.md](CONTRIBUTING.md).

## Bảo mật

Không bao giờ commit mật khẩu hay khóa bí mật thật. Dùng file `.env` (đã nằm trong `.gitignore`); chỉ commit `.env.example` với giá trị giả.
