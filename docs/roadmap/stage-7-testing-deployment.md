# Stage 7 — Kiểm thử, ổn định và triển khai

## Tình trạng hiện tại

Đã có Dockerfile backend/frontend, `docker-compose.yml` cho PostgreSQL và GitHub Actions workflow. Compose hiện map PostgreSQL host port `5433`; backend container dùng `3000`; frontend image dùng Nginx port `80`.

Các phần còn thiếu/lệch:

- `backend/.dockerignore` chưa có.
- Backend package scripts hiện không khai báo `test` hoặc `test:e2e`, trong khi CI gọi cả hai; chưa có `backend/test/`.
- Backend lint script tham chiếu thư mục `test/`, cần xác nhận/điều chỉnh khi chưa có thư mục đó.
- Cần xác nhận branch protection đã yêu cầu đúng status checks; workflow chỉ chạy trên PR vào main.
- Build/run Docker và CI chưa được xác nhận trong roadmap này; cần chạy và xử lý lỗi trước khi coi hoàn tất.

## Việc cần làm

1. Viết unit/integration/e2e tests cho các luồng và quyền chính; bổ sung scripts backend khớp CI.
2. Thêm `backend/.dockerignore`, giữ `.env` ngoài build context.
3. Chạy migrations trên database sạch và kiểm tra restart/volume.
4. Chạy Docker build cho hai image, kiểm tra readiness/health và proxy frontend.
5. Sửa CI để chỉ gọi scripts hiện có hoặc thêm scripts/tests còn thiếu; dùng PostgreSQL service cho integration tests.
6. Rà secret, CORS, rate limit, role/ownership, upload và log PII/token.
7. Hoàn thiện README setup, seed dữ liệu demo, backup/restore, migration và rollback.
8. Kiểm tra branch protection và status checks trên GitHub.

## Điều kiện hoàn tất

Người mới dựng được theo README; tests/build/docker/CI xanh; migrations chạy từ DB sạch; health endpoints đúng; không commit secret; có quy trình backup/restore và triển khai.
