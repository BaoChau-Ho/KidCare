// @vitest-environment jsdom
// Lớp gọi API khi chạy với backend thật (VITE_USE_MOCK=false): URL, header, token, xử lý lỗi.
// fetch được giả lập nên không cần backend chạy. USE_MOCK được đọc lúc nạp module,
// vì vậy mỗi test nạp lại http.js / auth.js sau khi đặt biến môi trường.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const json = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data })
const notJson = (status) => ({
  status,
  ok: false,
  json: async () => {
    throw new SyntaxError('Unexpected token <')
  },
})

let fetchMock

async function load({ mock = false, apiUrl = '' } = {}) {
  vi.resetModules()
  vi.stubEnv('VITE_USE_MOCK', mock ? 'true' : 'false')
  vi.stubEnv('VITE_API_URL', apiUrl)
  const http = await import('./http.js')
  const auth = await import('./auth.js')
  const { ApiError } = await import('./apiError.js')
  return { ...http, ...auth, ApiError }
}

const lastCall = () => {
  const call = fetchMock.mock.calls.at(-1)
  if (!call) throw new Error('fetch chưa được gọi: hàm này không gửi request tới backend')
  const [url, init] = call
  return { url: new URL(url), init, headers: init.headers ?? {} }
}

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  fetchMock = vi.fn().mockResolvedValue(json(200, { ok: true }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('http.js với backend thật', () => {
  it('HTTP-01 GET: ghép URL mặc định, bỏ tham số rỗng / null, không gửi Content-Type', async () => {
    const { api } = await load()
    await api('GET', '/children', { query: { classId: 'abc', status: '', query: null, page: 2 } })

    const { url, init, headers } = lastCall()
    expect(url.origin).toBe('http://localhost:3000')
    expect(url.pathname).toBe('/children')
    expect(Object.fromEntries(url.searchParams)).toEqual({ classId: 'abc', page: '2' })
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect(headers).not.toHaveProperty('Content-Type')
  })

  it('HTTP-02 dùng VITE_API_URL khi có', async () => {
    const { api } = await load({ apiUrl: 'https://api.kidcare.test' })
    await api('GET', '/classes')
    expect(lastCall().url.href).toBe('https://api.kidcare.test/classes')
  })

  it('HTTP-03 đã đăng nhập → gửi Authorization: Bearer <accessToken>; chưa đăng nhập → không gửi', async () => {
    const { api, saveSession } = await load()
    await api('GET', '/users')
    expect(lastCall().headers).not.toHaveProperty('Authorization')

    saveSession({ accessToken: 'jwt-123', user: { role: 'admin' } })
    await api('GET', '/users')
    expect(lastCall().headers.Authorization).toBe('Bearer jwt-123')
  })

  it('HTTP-04 POST JSON: Content-Type application/json, body được JSON.stringify', async () => {
    const { api } = await load()
    await api('POST', '/classes', { body: { name: 'Lá 1', academicYear: '2026-2027' } })
    const { init, headers } = lastCall()
    expect(headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ name: 'Lá 1', academicYear: '2026-2027' })
  })

  it('HTTP-05 gửi FormData (upload ảnh): không tự đặt Content-Type để trình duyệt thêm boundary', async () => {
    const { api } = await load()
    const form = new FormData()
    form.append('file', new Blob(['x']), 'a.png')
    await api('POST', '/activities/1/images', { body: form })
    const { init, headers } = lastCall()
    expect(init.body).toBe(form)
    expect(headers).not.toHaveProperty('Content-Type')
  })

  it('HTTP-06 204 No Content → trả null, không đọc body', async () => {
    const { api } = await load()
    const res = { status: 204, ok: true, json: vi.fn() }
    fetchMock.mockResolvedValue(res)
    await expect(api('DELETE', '/classes/1/teachers/2')).resolves.toBeNull()
    expect(res.json).not.toHaveBeenCalled()
  })

  it('HTTP-07 lỗi nghiệp vụ { code, message } → ApiError giữ nguyên status, code, message', async () => {
    const { api, ApiError } = await load()
    fetchMock.mockResolvedValue(json(403, { code: 'CHILD_ACCESS_DENIED', message: 'Bạn không được truy cập hồ sơ trẻ này.' }))
    const error = await api('GET', '/children/1').catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403, code: 'CHILD_ACCESS_DENIED', message: 'Bạn không được truy cập hồ sơ trẻ này.' })
  })

  it('HTTP-08 lỗi 400 của ValidationPipe (message là mảng) → gộp thành một câu, code ERROR', async () => {
    const { api } = await load()
    fetchMock.mockResolvedValue(json(400, { statusCode: 400, error: 'Bad Request', message: ['name must be a string', 'classId must be a UUID'] }))
    await expect(api('POST', '/children', { body: {} })).rejects.toMatchObject({
      status: 400,
      code: 'ERROR',
      message: 'name must be a string; classId must be a UUID',
    })
  })

  it('HTTP-09 lỗi không có body JSON (ví dụ 502 từ proxy) → thông báo chung, không crash', async () => {
    const { api } = await load()
    fetchMock.mockResolvedValue(notJson(502))
    await expect(api('GET', '/classes')).rejects.toMatchObject({ status: 502, code: 'ERROR', message: 'Có lỗi xảy ra. Vui lòng thử lại.' })
  })

  it('HTTP-10 mất mạng / backend tắt → ApiError status 0, code NETWORK', async () => {
    const { api } = await load()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(api('GET', '/classes')).rejects.toMatchObject({ status: 0, code: 'NETWORK' })
  })

  it('HTTP-11 mặc định (không đặt VITE_USE_MOCK=false) dùng mock server, không gọi mạng', async () => {
    const { api } = await load({ mock: true })
    await api('GET', '/classes').catch(() => {})
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('auth.js với backend thật', () => {
  const backendUser = { id: 'u1', email: 'medical@kidcare.test', fullName: 'Y tá', role: 'MEDICAL_STAFF', status: 'ACTIVE' }

  it('HTTP-12 đăng nhập gọi POST /auth/login, đổi role API sang role giao diện, token lưu ở accessToken', async () => {
    const { login } = await load()
    fetchMock.mockResolvedValue(json(200, { user: backendUser, token: 'jwt-abc', expiresIn: 3600 }))

    const session = await login('medical@kidcare.test', 'Password@123')

    const { url, init } = lastCall()
    expect(init.method).toBe('POST')
    expect(url.pathname).toBe('/auth/login')
    expect(JSON.parse(init.body)).toEqual({ email: 'medical@kidcare.test', password: 'Password@123' })
    expect(session.user.role).toBe('medical')
    expect(session.accessToken).toBe('jwt-abc')
  })

  it('HTTP-13 token từ đăng nhập được http.js gắn vào các request sau', async () => {
    const { login, saveSession, api } = await load()
    fetchMock.mockResolvedValueOnce(json(200, { user: backendUser, token: 'jwt-abc' }))
    saveSession(await login('medical@kidcare.test', 'Password@123'))

    await api('GET', '/children')
    expect(lastCall().headers.Authorization).toBe('Bearer jwt-abc')
  })

  it.each([
    [401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.'],
    [403, 'ACCOUNT_PENDING', 'Tài khoản đang chờ admin duyệt.'],
    [403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị vô hiệu hóa.'],
  ])('HTTP-14 đăng nhập lỗi %i %s → giữ đúng code và thông báo của backend', async (status, code, message) => {
    const { login } = await load()
    fetchMock.mockResolvedValue(json(status, { code, message }))
    await expect(login('a@kidcare.test', 'x')).rejects.toMatchObject({ code, message })
  })

  // Lỗi đã biết: khi tắt mock, đăng ký và duyệt đăng ký (UC-02) vẫn chạy trên localStorage,
  // không gọi backend; registerRequest còn không nhận mật khẩu dù POST /auth/register bắt buộc.
  // Khi đã nối với backend, các test này sẽ báo fail → đổi it.fails thành it.
  it.fails('HTTP-15 đăng ký gọi POST /auth/register kèm mật khẩu', async () => {
    const { registerRequest } = await load()
    fetchMock.mockResolvedValue(json(201, { id: 'r1', status: 'PENDING' }))
    await registerRequest({
      fullName: 'Nguyễn Văn A',
      email: 'a@kidcare.test',
      phone: '0912345678',
      role: 'PARENT',
      nationalId: '012345678901',
      password: 'Password@123',
    })
    const { url, init } = lastCall()
    expect(url.pathname).toBe('/auth/register')
    expect(JSON.parse(init.body)).toMatchObject({ email: 'a@kidcare.test', password: 'Password@123' })
  })

  it.fails('HTTP-16 admin xem danh sách đăng ký qua GET /admin/registration-requests', async () => {
    const { listRequests } = await load()
    fetchMock.mockResolvedValue(json(200, []))
    await listRequests()
    expect(lastCall().url.pathname).toBe('/admin/registration-requests')
  })

  it.fails('HTTP-17 admin duyệt đăng ký qua PATCH /admin/registration-requests/{id}/approve', async () => {
    const { approveRequest } = await load()
    fetchMock.mockResolvedValue(json(200, { id: 'r1', status: 'APPROVED' }))
    await approveRequest('r1').catch(() => {}) // bản mock ném NOT_FOUND vì localStorage trống
    const { url, init } = lastCall()
    expect(init.method).toBe('PATCH')
    expect(url.pathname).toBe('/admin/registration-requests/r1/approve')
  })
})
