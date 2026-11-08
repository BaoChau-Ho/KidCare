import { getSession, clearSession } from './auth.js'
import { USE_MOCK, API_URL } from './config.js'
import { ApiError } from './apiError.js'
import { mockRequest } from './mockServer.js'

// Mặc định dùng mock server (dữ liệu trong localStorage) giống auth.js.
// Khi backend sẵn sàng: đặt VITE_USE_MOCK=false và VITE_API_URL trong .env (xem config.js)
export { USE_MOCK }
const BASE = API_URL

const clean = (q = {}) => Object.fromEntries(Object.entries(q).filter(([, v]) => v !== '' && v != null))

export async function api(method, path, { query, body } = {}) {
  if (USE_MOCK) return mockRequest(method, path, { query: clean(query), body })

  const qs = new URLSearchParams(clean(query)).toString()
  const token = getSession()?.accessToken
  let res
  try {
    res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ''}`, {
      method,
      // Không đặt credentials: 'include'. Xác thực bằng token Bearer, không dùng cookie; gửi kèm cookie sẽ buộc backend phải bật
      // Access-Control-Allow-Credentials, nếu không trình duyệt chặn phản hồi và fetch báo lỗi mạng dù backend vẫn trả lời.
      headers: {
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK', `Không kết nối được máy chủ (${BASE}). Kiểm tra backend đã chạy chưa, VITE_API_URL có đúng cổng không, và CORS cho phép địa chỉ giao diện này (xem Console, F12).`)
  }
  // Token hết hạn hoặc không hợp lệ: xóa phiên và quay về trang đăng nhập
  if (res.status === 401 && token) {
    clearSession()
    if (typeof window !== 'undefined') window.location.assign('/login')
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const m = data?.message
    // `field` (nếu backend gửi) để hiện lỗi ngay dưới đúng ô nhập
    throw new ApiError(res.status, data?.code || 'ERROR', (Array.isArray(m) ? m.join('; ') : m) || 'Có lỗi xảy ra. Vui lòng thử lại.', data?.field)
  }
  return data
}