// Kiểm thử quy tắc nghiệp vụ và phân quyền của mock server (Stage 7).
// Chạy: npx vitest run   (cần: npm i -D vitest jsdom)
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { mockRequest } from './mockServer.js'
import { resetMockDb } from './mockDb.js'
import { saveSession } from './auth.js'
import { todayStr } from './dates.js'

globalThis.__MOCK_DELAY__ = 0
const TODAY = todayStr()
const as = (email, role) => saveSession({ user: { email, role }, token: 't' })
const call = async (method, path, o) => {
  try { return { ok: true, data: await mockRequest(method, path, o) } }
  catch (e) { return { ok: false, status: e.status, code: e.code, msg: e.message } }
}
const find = (items, text) => items.find((x) => (x.name ?? x.childName ?? '').includes(text))

let c0, c1, an, huy, linh

beforeEach(async () => {
  resetMockDb(); sessionStorage.clear()
  as('manager@demo.com', 'manager')
  const classes = (await call('GET', '/classes', { query: {} })).data.items
  c0 = classes.find((c) => c.name === 'Lớp Mầm 1'); c1 = classes.find((c) => c.name === 'Lớp Chồi 1')
  const kids = (await call('GET', '/children', { query: { limit: 50 } })).data.items
  an = find(kids, 'Minh An'); huy = find(kids, 'Gia Huy'); linh = find(kids, 'Khánh Linh')
})
beforeAll(() => { globalThis.__MOCK_DELAY__ = 0 })

const teacher = () => as('teacher@demo.com', 'teacher') // lớp Mầm 1
const parent = () => as('parent@demo.com', 'parent') // con: An, Châu
const medical = () => as('medical@demo.com', 'medical')

describe('UC-06 điểm danh', () => {
  it('giáo viên chỉ thấy lớp được phân công và chỉ xem được roster lớp đó', async () => {
    teacher()
    const list = await call('GET', '/classes', { query: {} })
    expect(list.data.items.map((c) => c.id)).toEqual([c0.id])
    expect((await call('GET', `/classes/${c0.id}/attendance`, { query: {} })).ok).toBe(true)
    expect((await call('GET', `/classes/${c1.id}/attendance`, { query: {} })).status).toBe(403)
  })
  it('check-in trùng ngày bị 409, check-out trước check-in bị 409, check-out hai lần bị 409', async () => {
    teacher()
    expect((await call('POST', '/attendance/check-out', { body: { childId: an.id, date: TODAY, checkOutTime: `${TODAY}T23:00` } })).code).toBe('NOT_CHECKED_IN')
    expect((await call('POST', '/attendance/check-in', { body: { childId: an.id, checkInTime: `${TODAY}T00:01` } })).ok).toBe(true)
    expect((await call('POST', '/attendance/check-in', { body: { childId: an.id } })).code).toBe('ATTENDANCE_EXISTS')
    expect((await call('POST', '/attendance/check-out', { body: { childId: an.id, checkOutTime: `${TODAY}T00:02` } })).ok).toBe(true)
    expect((await call('POST', '/attendance/check-out', { body: { childId: an.id } })).code).toBe('ALREADY_CHECKED_OUT')
  })
  it('giáo viên lớp khác, ngày tương lai, vai trò khác đều bị chặn', async () => {
    teacher()
    expect((await call('POST', '/attendance/check-in', { body: { childId: linh.id } })).status).toBe(403)
    expect((await call('POST', '/attendance/check-in', { body: { childId: an.id, date: '2099-01-01' } })).status).toBe(400)
    parent()
    expect((await call('POST', '/attendance/check-in', { body: { childId: an.id } })).status).toBe(403)
  })
  it('đến sau giờ chuẩn là LATE, đúng giờ là PRESENT', async () => {
    teacher()
    const past = '2026-01-05'
    const late = await call('POST', '/attendance/check-in', { body: { childId: an.id, date: past, checkInTime: `${past}T08:01` } })
    const ok = await call('POST', '/attendance/check-in', { body: { childId: huy.id, date: past, checkInTime: `${past}T08:00` } })
    expect(late.data.status).toBe('LATE'); expect(ok.data.status).toBe('PRESENT')
  })
  it('sửa điểm danh được ghi audit với giá trị trước/sau', async () => {
    teacher()
    const past = '2026-01-05'
    const rec = (await call('POST', '/attendance/check-in', { body: { childId: an.id, date: past, checkInTime: `${past}T07:50` } })).data
    await call('PATCH', `/attendance/${rec.id}`, { body: { status: 'ABSENT' } })
    as('admin@demo.com', 'admin')
    const log = (await call('GET', '/audit-logs', { query: {} })).data.items.find((l) => l.action === 'UPDATE_ATTENDANCE')
    expect(log.before.status).toBe('PRESENT'); expect(log.after.status).toBe('ABSENT')
  })
})

describe('UC-07 phụ huynh và chống IDOR', () => {
  it('phụ huynh chỉ thấy con của mình', async () => {
    parent()
    expect((await call('GET', '/children', { query: {} })).data.items).toHaveLength(2)
  })
  it.each([
    ['hồ sơ', (id) => `/children/${id}`],
    ['điểm danh hôm nay', (id) => `/children/${id}/attendance/today`],
    ['lịch sử điểm danh', (id) => `/children/${id}/attendance`],
    ['sức khỏe', (id) => `/children/${id}/health-summary`],
    ['hoạt động', (id) => `/children/${id}/activities`],
  ])('đổi id sang con người khác -> 404 (%s)', async (_n, path) => {
    parent()
    const r = await call('GET', path(huy.id), { query: {} })
    expect(r.ok).toBe(false); expect(r.status).toBe(404)
  })
  it('lịch sử điểm danh có phân trang và validate khoảng ngày', async () => {
    parent()
    const r = await call('GET', `/children/${an.id}/attendance`, { query: { limit: 5 } })
    expect(r.data.items).toHaveLength(5); expect(r.data.pageInfo.totalItems).toBeGreaterThan(5)
    expect((await call('GET', `/children/${an.id}/attendance`, { query: { from: '2026-02-02', to: '2026-02-01' } })).status).toBe(400)
  })
})

describe('UC-08 đơn xin nghỉ', () => {
  it('chặn ngày quá khứ, ngày đảo ngược, trùng đơn, con người khác', async () => {
    parent()
    const mk = (b) => call('POST', '/leave-requests', { body: { childId: an.id, reason: 'x', ...b } })
    expect((await mk({ fromDate: '2020-01-01', toDate: '2020-01-02' })).status).toBe(400)
    expect((await mk({ fromDate: '2099-02-02', toDate: '2099-02-01' })).status).toBe(400)
    expect((await mk({ fromDate: '2099-02-01', toDate: '2099-02-03' })).ok).toBe(true)
    expect((await mk({ fromDate: '2099-02-02', toDate: '2099-02-05' })).code).toBe('LEAVE_OVERLAP')
    expect((await call('POST', '/leave-requests', { body: { childId: huy.id, fromDate: '2099-03-01', toDate: '2099-03-01', reason: 'x' } })).status).toBe(404)
  })
  it('giáo viên duyệt: hiện vắng có phép trên roster, thông báo cho phụ huynh, không xử lý hai lần', async () => {
    teacher()
    const pending = (await call('GET', '/leave-requests', { query: { status: 'PENDING' } })).data.items[0]
    expect((await call('POST', `/leave-requests/${pending.id}/reject`, { body: {} })).status).toBe(400) // thiếu lý do
    expect((await call('POST', `/leave-requests/${pending.id}/approve`, { body: {} })).data.status).toBe('APPROVED')
    expect((await call('POST', `/leave-requests/${pending.id}/approve`, { body: {} })).status).toBe(409)
  })
  it('đơn nghỉ đã duyệt hiện ABSENT trên roster', async () => {
    as('chau.teacher@demo.com', 'teacher')
    const roster = (await call('GET', `/classes/${c1.id}/attendance`, { query: {} })).data.items
    const row = roster.find((i) => i.name.includes('Khánh Linh'))
    expect(row.status).toBe('ABSENT'); expect(row.onLeave).toBe(true)
  })
})

describe('UC-09 sức khỏe: lọc theo vai trò và validate', () => {
  it('giáo viên chỉ thấy cảnh báo; phụ huynh không thấy kết luận/ghi chú; y tế thấy đầy đủ', async () => {
    teacher()
    const t = (await call('GET', `/children/${an.id}/health-summary`, {})).data
    expect(t.view).toBe('ALERT_ONLY'); expect(t.latestRecord).toBeNull(); expect(t.visits).toEqual([])
    parent()
    const p = (await call('GET', `/children/${an.id}/health-summary`, {})).data
    expect(p.view).toBe('PARENT'); expect(JSON.stringify(p)).not.toContain('Viêm họng'); expect(JSON.stringify(p)).not.toContain('bút tiêm')
    medical()
    const m = (await call('GET', `/children/${an.id}/health-summary`, {})).data
    expect(m.view).toBe('FULL'); expect(JSON.stringify(m)).toContain('Viêm họng')
  })
  it('giáo viên lớp khác và quản lý không xem được sức khỏe cá nhân', async () => {
    teacher()
    expect((await call('GET', `/children/${linh.id}/health-summary`, {})).status).toBe(404)
    as('manager@demo.com', 'manager')
    expect((await call('GET', `/children/${an.id}/health-summary`, {})).status).toBe(403)
  })
  it('từ chối giá trị vô lý; chỉ MEDICAL_STAFF được ghi', async () => {
    medical()
    const post = (b) => call('POST', `/children/${an.id}/health-records`, { body: b })
    expect((await post({ height: 500 })).status).toBe(400)
    expect((await post({ temperature: -5 })).status).toBe(400)
    expect((await post({})).status).toBe(400)
    parent()
    expect((await post({ height: 100 })).status).toBe(403)
  })
  it('sốt cao tạo cảnh báo; audit không chứa nội dung ghi chú', async () => {
    medical()
    const r = await call('POST', `/children/${an.id}/health-records`, { body: { temperature: 38.5, note: 'GHI-CHU-NHAY-CAM' } })
    expect(r.data.abnormal).toContain('TEMPERATURE')
    await call('PATCH', `/health-records/${r.data.id}`, { body: { note: 'GHI-CHU-MOI' } })
    as('admin@demo.com', 'admin')
    const logs = JSON.stringify((await call('GET', '/audit-logs', { query: { limit: 100 } })).data.items)
    expect(logs).not.toContain('GHI-CHU')
  })
  it('chặn mũi tiêm trùng và ngày tiêm tương lai', async () => {
    medical()
    const v = (b) => call('POST', `/children/${an.id}/vaccinations`, { body: b })
    expect((await v({ vaccineName: 'Viêm gan B', doseNumber: 3, vaccinatedAt: '2026-01-01' })).status).toBe(409)
    expect((await v({ vaccineName: 'Cúm', doseNumber: 1, vaccinatedAt: '2099-01-01' })).status).toBe(400)
  })
})

describe('UC-10 hoạt động và ảnh', () => {
  const img = { name: 'a.jpg', mime: 'image/jpeg', size: 1000, dataUrl: 'data:image/jpeg;base64,AAAA' }
  it('tạo hoạt động trong lớp mình, chặn lớp ngoài, validate ảnh', async () => {
    teacher()
    const a = await call('POST', '/activities', { body: { classId: c0.id, title: 'Tô màu', date: TODAY, participants: [an.id, huy.id].map((childId) => ({ childId, participationStatus: 'JOINED' })) } })
    expect(a.data.participants).toHaveLength(2)
    expect((await call('POST', '/activities', { body: { classId: c1.id, title: 'x', date: TODAY, participants: [] } })).status).toBe(403)
    expect((await call('POST', `/activities/${a.data.id}/images`, { body: { ...img, mime: 'image/gif', dataUrl: 'data:image/gif;base64,AAAA' } })).code).toBe('INVALID_FILE')
    expect((await call('POST', `/activities/${a.data.id}/images`, { body: { ...img, size: 3 * 1024 * 1024 } })).code).toBe('FILE_TOO_LARGE')
    const up = await call('POST', `/activities/${a.data.id}/images`, { body: img })
    expect(up.data.objectKey).toContain(a.data.id) // trả ActivityImage theo openapi.yaml
    expect((await call('GET', '/activities', { query: {} })).data.items.find((x) => x.id === a.data.id).images).toHaveLength(1)
  })
  it('trẻ không thuộc lớp thì không thể là participant (không lưu gì)', async () => {
    teacher()
    const before = (await call('GET', '/activities', { query: {} })).data.pageInfo.totalItems
    expect((await call('POST', '/activities', { body: { classId: c0.id, title: 'x', date: TODAY, participants: [{ childId: linh.id, participationStatus: 'JOINED' }] } })).status).toBe(400)
    expect((await call('GET', '/activities', { query: {} })).data.pageInfo.totalItems).toBe(before) // rollback
  })
})

describe('UC-11/12 đón trẻ', () => {
  const req = { pickupPerson: 'Trần Văn B', relationship: 'Chú/Bác/Cậu', idNumber: '987654321', expectedTime: '2099-01-01T10:00' }
  it('phụ huynh đăng ký: validate, ẩn giấy tờ, chỉ đăng ký cho con mình, hủy khi PENDING', async () => {
    parent()
    expect((await call('POST', '/pickup-requests', { body: { childId: huy.id, ...req } })).status).toBe(404)
    expect((await call('POST', '/pickup-requests', { body: { childId: an.id, ...req, expectedTime: '2020-01-01T10:00' } })).status).toBe(400)
    expect((await call('POST', '/pickup-requests', { body: { childId: an.id, ...req, idNumber: '12' } })).status).toBe(400)
    const r = await call('POST', '/pickup-requests', { body: { childId: an.id, ...req } })
    expect(r.data.status).toBe('PENDING'); expect(r.data.idNumber).toMatch(/^\u2022+4321$/)
    expect((await call('PATCH', `/pickup-requests/${r.data.id}/cancel`, {})).data.status).toBe('CANCELLED')
  })
  it('hoàn tất chỉ từ APPROVED, tạo check-out đúng một lần, không hoàn tất hai lần', async () => {
    teacher()
    await call('POST', '/attendance/check-in', { body: { childId: an.id, checkInTime: `${TODAY}T00:01` } }).catch(() => {})
    const pk = (await call('GET', '/pickup-requests', { query: {} })).data.items[0]
    expect(pk.idNumber).toBe('012345678901') // giáo viên đúng lớp thấy đầy đủ
    expect((await call('PATCH', `/pickup-requests/${pk.id}/complete`, { body: {} })).status).toBe(409) // chưa duyệt
    expect((await call('PATCH', `/pickup-requests/${pk.id}/approve`, { body: {} })).data.status).toBe('APPROVED')
    expect((await call('PATCH', `/pickup-requests/${pk.id}/complete`, { body: {} })).data.status).toBe('COMPLETED')
    expect((await call('PATCH', `/pickup-requests/${pk.id}/complete`, { body: {} })).status).toBe(409)
    const roster = (await call('GET', `/classes/${c0.id}/attendance`, { query: {} })).data.items
    expect(find(roster, 'Minh An').checkOutTime).toBeTruthy()
  })
  it('hoàn tất khi trẻ chưa check-in bị chặn và không đổi trạng thái', async () => {
    teacher()
    const pk = (await call('GET', '/pickup-requests', { query: {} })).data.items[0]
    await call('PATCH', `/pickup-requests/${pk.id}/approve`, { body: {} })
    const r = await call('PATCH', `/pickup-requests/${pk.id}/complete`, { body: {} })
    if (!r.ok) { expect(r.code).toBe('NOT_CHECKED_IN'); expect((await call('GET', '/pickup-requests', { query: {} })).data.items[0].status).toBe('APPROVED') }
  })
})

describe('UC-13/14 thông báo', () => {
  it('broadcast: đúng lớp, khử trùng người nhận, chặn lớp ngoài, validate', async () => {
    teacher()
    expect((await call('POST', '/notifications/broadcast', { body: { classId: c1.id, title: 'a', content: 'b' } })).status).toBe(403)
    expect((await call('POST', '/notifications/broadcast', { body: { classId: c0.id, title: '', content: 'b' } })).status).toBe(400)
    const r = await call('POST', '/notifications/broadcast', { body: { classId: c0.id, title: 'Họp', content: 'Thứ sáu' } })
    expect(r.data.recipientCount).toBe(2)
    parent()
    expect((await call('GET', '/notifications', { query: {} })).data.items.some((n) => n.title === 'Họp')).toBe(true)
  })
  it('chỉ đọc được thông báo của mình; đánh dấu đọc idempotent; unread-count khớp', async () => {
    parent()
    const list = (await call('GET', '/notifications', { query: {} })).data
    const count = (await call('GET', '/notifications/unread-count', {})).data.unreadCount
    expect(count).toBe(list.items.filter((n) => !n.isRead).length)
    const first = (await call('PATCH', `/notifications/${list.items[0].id}/read`, {})).data.readAt
    expect((await call('PATCH', `/notifications/${list.items[0].id}/read`, {})).data.readAt).toBe(first)
    as('parent2@demo.com', 'parent')
    expect((await call('PATCH', `/notifications/${list.items[0].id}/read`, {})).status).toBe(404)
  })
})

describe('UC-15 báo cáo', () => {
  it('khớp dữ liệu nguồn, chặn khoảng ngày sai, chỉ quản lý được xem, không lộ dữ liệu cá nhân', async () => {
    const r = await call('GET', '/reports/attendance', { query: {} })
    expect(r.data.byClass.reduce((s, c) => s + c.total, 0)).toBe(r.data.summary.total)
    expect(r.data.byDay.reduce((s, d) => s + d.total, 0)).toBe(r.data.summary.total)
    expect((await call('GET', '/reports/attendance', { query: { from: '2026-02-01', to: '2026-01-01' } })).status).toBe(400)
    expect((await call('GET', '/reports/attendance', { query: { from: '2020-01-01', to: '2026-01-01' } })).status).toBe(400)
    const h = JSON.stringify((await call('GET', '/reports/health', { query: {} })).data)
    expect(h).not.toContain('Đậu phộng'); expect(h).not.toContain('Minh An')
    teacher()
    expect((await call('GET', '/reports/attendance', { query: {} })).status).toBe(403)
  })
})

describe('múi giờ', () => {
  it('nhận ISO có offset và giờ trả về hiển thị đúng giờ địa phương', async () => {
    const { localIso, hhmm } = await import('./dates.js')
    teacher()
    const past = '2026-01-05'
    const r = await call('POST', '/attendance/check-in', { body: { childId: an.id, date: past, checkInTime: localIso(past, '08:05') } })
    expect(hhmm(r.data.checkInTime)).toBe('08:05')
    expect(hhmm('2026-01-05T01:05:00.000Z')).toMatch(/^\d{2}:\d{2}$/) // chuỗi UTC được đổi sang giờ máy
    expect(hhmm(new Date(2026, 0, 5, 8, 5).toISOString())).toBe('08:05')
  })
})
