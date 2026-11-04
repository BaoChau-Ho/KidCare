// Lỗi chuẩn hóa từ API (hoặc từ mock server)
export class ApiError extends Error {
  constructor(status, code, message, field) {
    super(message)
    this.status = status
    this.code = code
    this.field = field // tên trường gây lỗi (nếu có) để hiện ngay dưới ô nhập
  }
}
