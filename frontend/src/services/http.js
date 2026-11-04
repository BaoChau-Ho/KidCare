import { getSession } from './auth.js'
import { ApiError } from './apiError.js'
import { mockRequest } from './mockServer.js'

// Mặc định dùng mock server (dữ liệu trong localStorage) giống auth.js.
// Khi backend sẵn sàng: đặt VITE_USE_MOCK=false và VITE_API_URL trong .env
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const clean = (q = {}) => Object.fromEntries(Object.entries(q).filter(([, v]) => v !== '' && v != null))

export async function api(method, path, { query, body } = {}) {
  if (USE_MOCK) return mockRequest(method, path, { query: clean(query), body })

  const qs = new URLSearchParams(clean(query)).toString()
  const token = getSession()?.accessToken
  let res
  try {
    res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ''}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const m = data?.message
    throw new ApiError(res.status, data?.code || 'ERROR', (Array.isArray(m) ? m.join('; ') : m) || 'Có lỗi xảy ra. Vui lòng thử lại.')
  }
  return data
}
