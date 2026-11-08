// Cấu hình chung cho lớp gọi API. Đặt trong frontend/.env:
//   VITE_USE_MOCK=false            dùng backend thật (mặc định true: dùng dữ liệu mô phỏng trong trình duyệt)
//   VITE_API_URL=http://localhost:3000
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
