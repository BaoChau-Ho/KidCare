## Làm gì?

<!-- Mô tả ngắn gọn thay đổi. Giữ PR nhỏ (khoảng dưới 400 dòng). -->

## Liên quan

- FR: <!-- ví dụ FR-ATT-01 -->
- Use case: <!-- ví dụ UC-ATT-02 -->
- Increment: <!-- 0 / 1 / 2 / 3 / 4 / 5 -->

## Cách kiểm tra

<!-- Các bước để reviewer chạy thử, hoặc tên test đã thêm. -->

## Checklist (Definition of Done)

- [ ] Có mã FR hoặc use case liên quan, đã viết trước khi code
- [ ] Có test tự động cho logic chính và cho quyền truy cập; CI xanh
- [ ] Đã cập nhật `openapi.yaml` (nếu đổi API)
- [ ] Thay đổi database có migration đi kèm
- [ ] Không có mật khẩu hay khóa bí mật thật trong code
- [ ] Đã cập nhật bảng truy vết và tài liệu liên quan
- [ ] Chạy được trên `develop` bằng `docker compose up`
- [ ] Có ít nhất một người khác review (không tự duyệt PR của mình)
