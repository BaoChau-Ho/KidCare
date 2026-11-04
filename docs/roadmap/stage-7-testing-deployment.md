# Stage 7 ? Ki?m th?, ?n ??nh v? tri?n khai

## M?c ti?u

??ng g?i s?n ph?m ?? qua c?c stage ch?c n?ng, ch?ng minh lu?ng ch?nh ho?t ??ng v? c? th? d?ng l?i t? README/CI.

## Checklist th?c hi?n

1. **?n ??nh y?u c?u:** r? UC, traceability, ERD, OpenAPI v?i code; ghi c?c ch?c n?ng ch?a l?m v? quy?t ??nh b? ho?n.
2. **Test backend:** unit cho service/quy t?c nghi?p v?; integration v?i PostgreSQL th?t; e2e cho login, quy?n, IDOR v? lu?ng UC tr?ng y?u.
3. **Test frontend:** validation, loading/error/empty states, route theo role, lu?ng demo.
4. **Data demo:** seed script idempotent t?o admin, manager, teacher, parent, l?p, tr? v? d? li?u c?n thi?t; kh?ng d?ng m?t kh?u th?t.
5. **Docker:** build backend/frontend; Compose ch?y app v? Postgres v?i volume; health/readiness probes; `.dockerignore` lo?i `.env`.
6. **CI:** PR ch?y lint, unit/e2e/build v? Docker build; PostgreSQL service cho job integration c?n DB.
7. **B?o m?t:** ki?m tra secret kh?ng commit, rate limiting/login, CORS, role/ownership, upload, log kh?ng l? PII/token; d?ng HTTPS ? m?i tr??ng tri?n khai.
8. **Tri?n khai:** c?u h?nh env ngo?i image, migration ch?y c? ki?m so?t, backup/restore DB, logging/monitoring v? h??ng d?n rollback.
9. **B?n giao:** README h??ng d?n clone/setup, l?nh ch?y, test, demo, ki?n tr?c v? known limitations; review PR v? retrospective.

## Definition of Done

- Ng??i m?i d?ng ???c m?i tr??ng theo README.
- CI xanh; Docker images build v? health/readiness ??ng.
- Migration c? th? ?p d?ng t? database m?i; backup/restore ???c di?n t?p.
- C?c lu?ng UC ?u ti?n ch?y qua UI/API; quy?n v? IDOR ??t.
- Kh?ng c? secret trong Git; m?i tr??ng tri?n khai d?ng c?u h?nh ri?ng.
