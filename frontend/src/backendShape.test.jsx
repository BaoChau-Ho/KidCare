// @vitest-environment jsdom
// Giao diện giai đoạn 2 khi nhận dữ liệu đúng dạng backend thật / openapi.yaml.
// Giao diện được viết trên mock server, và mock trả dữ liệu khác dạng (xem services/mockContract.test.js).
// Ở đây http.js được thay bằng một "backend giả" trả đúng hợp đồng, để thấy trang hiển thị ra sao
// khi đặt VITE_USE_MOCK=false.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, configure, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App.jsx'
import { api } from './services/http.js'
import { saveSession } from './services/auth.js'
import { ApiError } from './services/apiError.js'

vi.mock('./services/http.js', () => ({ api: vi.fn(), USE_MOCK: false }))
configure({ asyncUtilTimeout: 4000 })

const HA = 'a1111111-1111-4111-8111-111111111111'
const BINH = 'a2222222-2222-4222-8222-222222222222'
const MAI = 'a3333333-3333-4333-8333-333333333333'
const CLASS_ID = 'c1111111-1111-4111-8111-111111111111'
const CHILD_ID = 'd1111111-1111-4111-8111-111111111111'
const page = (items) => ({ items, pageInfo: { page: 1, limit: 20, totalItems: items.length, totalPages: 1 } })
const user = (id, fullName, email, role) => ({ id, fullName, email, phone: null, role, status: 'ACTIVE', createdAt: '2026-11-01T00:00:00.000Z' })

// Dữ liệu đúng schema Classroom / TeacherSummary / Child / ChildParentSummary / AuditLog trong openapi.yaml
const classroom = {
  id: CLASS_ID,
  name: 'Lớp Lá 1',
  academicYear: '2026-2027',
  status: 'ACTIVE',
  teacherUserIds: [HA],
  teachers: [{ id: HA, fullName: 'Nguyễn Thu Hà', email: 'teacher@demo.com' }],
  childCount: 3,
}
const child = {
  id: CHILD_ID,
  name: 'Đỗ Gia Huy',
  dateOfBirth: '2022-01-20',
  gender: 'MALE',
  address: null,
  avatarUrl: null,
  classId: CLASS_ID,
  className: 'Lớp Lá 1',
  status: 'ACTIVE',
  parentUserIds: [MAI],
  parents: [{ parentUserId: MAI, fullName: 'Đỗ Thị Mai', relationship: 'MOTHER' }],
}
const auditLog = {
  id: 'e1111111-1111-4111-8111-111111111111',
  actorUserId: 'a0000000-0000-4000-8000-000000000000',
  actorName: 'Quản trị viên',
  action: 'CHANGE_USER_ROLE',
  resourceType: 'user',
  resourceId: HA,
  resourceName: 'Nguyễn Thu Hà',
  oldValue: { role: 'TEACHER' },
  newValue: { role: 'MANAGER' },
  ipAddress: '10.0.0.1',
  createdAt: '2026-11-06T08:00:00.000Z',
}

function fakeBackend(method, path) {
  if (method === 'GET' && path === '/classes') return page([classroom])
  if (method === 'GET' && path === '/users') return page([user(HA, 'Nguyễn Thu Hà', 'teacher@demo.com', 'TEACHER'), user(BINH, 'Trần Văn Bình', 'binh@demo.com', 'TEACHER')])
  if (method === 'GET' && path === `/children/${CHILD_ID}`) return child
  if (method === 'GET' && path === '/audit-logs') return page([auditLog])
  if (method === 'GET' && path === '/notifications/unread-count') return { unreadCount: 0 }
  // Lỗi của backend thật không có `field` (khác mock): giao diện phải tự gắn lỗi 409 vào ô tên lớp.
  if (method === 'POST' && path === '/classes') throw new ApiError(409, 'CLASS_ALREADY_EXISTS', 'Tên lớp đã được dùng trong năm học này.')
  throw new Error(`backend giả chưa có ${method} ${path}`)
}

const open = (path, email, role) => {
  saveSession({ user: { email, role }, accessToken: 'jwt' })
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

beforeEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.mocked(api).mockReset().mockImplementation(async (method, path) => fakeBackend(method, path))
})

describe('giao diện giai đoạn 2 với dữ liệu đúng dạng backend thật', () => {
  it('BS-01 danh sách lớp hiện tên giáo viên phụ trách', async () => {
    open('/manager/classes', 'manager@demo.com', 'manager')
    const row = (await screen.findByText('Lớp Lá 1')).closest('tr')
    expect(within(row).getByText('Nguyễn Thu Hà')).toBeTruthy()
  })

  // Lỗi: TeachersModal so sánh theo t.userId (dạng của mock), backend trả t.id. Giáo viên đang dạy
  // bị coi là "đã khóa": hiện 2 lần, một lần kèm nhãn "Đã khóa" và ô chưa tích.
  // Khi đã sửa, test này sẽ báo fail → đổi it.fails thành it.
  it.fails('BS-02 hộp thoại phân công: giáo viên đang dạy hiện một lần, đã được tích, không bị gắn "Đã khóa"', async () => {
    const u = userEvent.setup()
    open('/manager/classes', 'manager@demo.com', 'manager')
    const row = (await screen.findByText('Lớp Lá 1')).closest('tr')
    await u.click(within(row).getByRole('button', { name: 'Giáo viên' }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('Trần Văn Bình')

    expect(within(dialog).getAllByText('Nguyễn Thu Hà')).toHaveLength(1)
    expect(within(dialog).queryByText('Đã khóa')).toBeNull()
    expect(within(dialog).getByRole('checkbox', { name: /Nguyễn Thu Hà/ }).checked).toBe(true)
  })

  it('BS-03 tab Phụ huynh của hồ sơ trẻ hiện tên và quan hệ từ dữ liệu backend', async () => {
    const u = userEvent.setup()
    open(`/manager/children/${CHILD_ID}`, 'manager@demo.com', 'manager')
    await u.click(await screen.findByRole('tab', { name: /Phụ huynh/ }))
    const row = screen.getByText('Đỗ Thị Mai').closest('tr')
    expect(within(row).getByText('Mẹ')).toBeTruthy()
  })

  // Lỗi: ACTION_LABELS chỉ có tên hành động của mock (CHANGE_ROLE); backend ghi CHANGE_USER_ROLE,
  // nên nhật ký hiện mã tiếng Anh. Khi đã sửa, test này sẽ báo fail → đổi it.fails thành it.
  it.fails('BS-04 nhật ký thao tác hiện tên hành động tiếng Việt cho hành động của backend', async () => {
    const u = userEvent.setup()
    open('/admin/users', 'admin@demo.com', 'admin')
    await u.click(await screen.findByRole('button', { name: 'Xem' }))
    const row = (await screen.findByText(/Nguyễn Thu Hà ·/)).closest('tr')
    expect(within(row).getByText('Đổi vai trò')).toBeTruthy()
  })

  it('BS-06 tạo lớp trùng tên: lỗi 409 của backend (không có field) hiện ngay dưới ô tên lớp', async () => {
    const u = userEvent.setup()
    open('/manager/classes', 'manager@demo.com', 'manager')
    await u.click(await screen.findByRole('button', { name: 'Thêm lớp' }))
    const dialog = await screen.findByRole('dialog')
    await u.type(within(dialog).getByLabelText('Tên lớp'), 'Lớp Lá 1')
    await u.type(within(dialog).getByLabelText('Năm học'), '2026-2027')
    await u.click(within(dialog).getByRole('button', { name: 'Tạo lớp' }))
    expect(await within(dialog).findByText('Tên lớp đã được dùng trong năm học này.')).toBeTruthy()
    expect(within(dialog).getByLabelText('Tên lớp').getAttribute('aria-invalid')).toBe('true')
  })

  it('BS-05 nhật ký thao tác đọc đúng người thao tác và đối tượng theo dạng backend', async () => {
    const u = userEvent.setup()
    open('/admin/users', 'admin@demo.com', 'admin')
    await u.click(await screen.findByRole('button', { name: 'Xem' }))
    const row = (await screen.findByText(/Nguyễn Thu Hà ·/)).closest('tr')
    expect(within(row).getByText('Quản trị viên')).toBeTruthy()
  })
})
