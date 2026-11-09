// Chạy trước mỗi file e2e, trước khi import AppModule:
// AuthModule ném lỗi ngay khi được nạp nếu thiếu JWT_SECRET (README vấn đề #2).
process.env.JWT_SECRET ??= 'kidcare-e2e-secret';
