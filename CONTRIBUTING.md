# Quy tắc làm việc nhóm

## 1. Quy trình Git cho một tính năng

```bash
git checkout develop
git pull
git checkout -b feature/auth-login
# ... viết code ...
git add .
git commit -m "feat(auth): add login endpoint"
git push -u origin feature/auth-login
```

1. Trên GitHub, mở Pull Request từ nhánh `feature/...` vào `develop` và điền mẫu mô tả.
2. Ít nhất **một người khác** review và duyệt; CI phải xanh. Không tự duyệt PR của mình.
3. Duyệt xong thì merge. Cuối mỗi Increment, merge `develop` vào `main` và gắn tag phiên bản (`v0.1`, `v0.2`, …).

**Không ai push thẳng vào `main` hoặc `develop`.** Giữ Pull Request nhỏ (khoảng dưới 400 dòng) để review nhanh. Cập nhật nhánh của bạn từ `develop` thường xuyên (mỗi ngày) để tránh xung đột lớn.

## 2. Thiết lập repo (vai E làm một lần trên GitHub)

- Tạo repo `kidcare`, mời cả 5 thành viên.
- Bật **branch protection** cho `main` và `develop`: bắt buộc Pull Request, bắt buộc ít nhất 1 review, bắt buộc CI (các job `format`, `compose`, `backend`, `frontend`) xanh trước khi merge, không cho push thẳng.
- Tạo nhánh `develop` từ `main`.

## 3. Quy ước commit (Conventional Commits)

Cấu trúc: `loại(phạm vi): mô tả ngắn` — viết ở thể mệnh lệnh, chữ thường, không dấu chấm cuối.

| Loại | Dùng khi | Ví dụ |
|---|---|---|
| `feat` | Thêm tính năng mới | `feat(attendance): add check-in endpoint` |
| `fix` | Sửa lỗi | `fix(attendance): fix late status calculation` |
| `docs` | Chỉ sửa tài liệu | `docs(requirements): add UC-ATT-02` |
| `test` | Thêm hoặc sửa test | `test(children): add IDOR test` |
| `refactor` | Sắp xếp lại code, không đổi hành vi | `refactor(notifications): extract channel interface` |
| `chore` / `ci` | Việc vặt, cấu hình, CI | `ci: add lint step` |

## 4. Khi nào một việc được coi là "xong" (Definition of Done)

- [ ] Có mã FR hoặc use case liên quan, đã viết trước khi code.
- [ ] Đã qua Pull Request và có ít nhất một người review.
- [ ] Có test tự động cho logic chính và cho quyền truy cập; CI xanh.
- [ ] Đã cập nhật `openapi.yaml`; thay đổi database có migration đi kèm.
- [ ] Không có mật khẩu hay khóa bí mật thật trong repo.
- [ ] Đã cập nhật bảng truy vết và tài liệu liên quan.
- [ ] Chạy được trên `develop` bằng `docker compose up`.

## 5. Quy tắc code cần nhớ

- Mỗi module một thư mục; module này **không truy vấn thẳng bảng** của module khác, chỉ gọi qua service của module đó.
- Mỗi API **mặc định từ chối** nếu chưa khai báo ai được dùng. Luôn kiểm tra cả **vai trò** lẫn **quyền sở hữu dữ liệu** (tránh IDOR).
- Mọi danh sách phải phân trang. Không ghi dữ liệu nhạy cảm (sức khỏe, mật khẩu) vào log. Không trả thừa thông tin của trẻ.
- Thay đổi cấu trúc database luôn qua migration, không sửa tay trong database.

## 6. Họp và ghi chép

- Họp ngắn 15 phút, 2–3 lần mỗi tuần: tôi đã làm gì, sẽ làm gì, đang vướng gì.
- Cuối mỗi Increment: demo nội bộ, chạy lại toàn bộ test, họp retrospective, ghi biên bản vào `docs/00-management` (mẫu: [Meeting_Minutes_Template.md](docs/00-management/Meeting_Minutes_Template.md)).
- Mọi thay đổi phạm vi hoặc yêu cầu phải ghi lại và được cả nhóm đồng ý; vai A giữ bản chuẩn.
- Lịch sử commit, Pull Request và biên bản họp chính là bằng chứng nhóm đã làm theo mô hình Incremental. Đừng xóa lịch sử.

## 7. Báo lỗi

Dùng mẫu **Báo lỗi (Bug report)** khi tạo issue. Ghi rõ mức độ (Critical, Major, Minor, Trivial) theo định nghĩa trong [Test_Plan.md](docs/03-testing/Test_Plan.md). Lỗi bảo mật như IDOR luôn đánh dấu Critical.
