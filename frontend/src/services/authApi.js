import { API_URL } from './config.js'

// Đăng nhập với backend thật: POST /auth/login -> { user: { id, email, fullName, role, status }, token, expiresIn }
// Lỗi của backend có dạng { code, message } (INVALID_CREDENTIALS, ACCOUNT_PENDING, ACCOUNT_DISABLED).
export async function realLogin(email, password) {
  let res
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  } catch {
    throw Object.assign(new Error('Không kết nối được máy chủ. Kiểm tra backend đã chạy chưa và VITE_API_URL có đúng không.'), { code: 'NETWORK' })
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const m = data?.message
    throw Object.assign(new Error((Array.isArray(m) ? m.join('; ') : m) || 'Không thể đăng nhập. Vui lòng thử lại sau.'), { code: data?.code ?? 'ERROR', status: res.status })
  }
  return data
}
