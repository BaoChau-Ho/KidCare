// Mock "backend" cho UC-03/04/05: mô phỏng đúng đường dẫn, mã lỗi và dạng dữ liệu trong openapi.yaml.
// Dữ liệu lưu trong localStorage. Mỗi request chạy trên bản sao; lỗi thì bỏ bản sao (giống rollback transaction).
import { getSession } from './auth.js'
import { ApiError } from './apiError.js'
import { normRole } from './labels.js'
import { loadDb, saveDb } from './mockDb.js'
import * as C from './mockCore.js'
// Mỗi module đăng ký các route của UC tương ứng
import './mock/attendance.js'
import './mock/leave.js'
import './mock/health.js'
import './mock/activities.js'
import './mock/pickups.js'
import './mock/notifications.js'
import './mock/reports.js'

const {
  ROLE_LIST, USER_STATUSES, CHILD_STATUSES, GENDERS, RELS, EMAIL_RE, delay, uid, now, fold, bad, found, need, paginate, audit,
  diffObj, isSelf, activeClass, activeChildCount, outClass, outChild, childSnap, validDob, route, routes,
  teacherClassIds, parentChildIds, classAccess, childAccess,
} = C

/* ---------- router ---------- */
/* UC-03 — tài khoản (Admin) */
route('GET', '/users', ({ db, actor, query }) => {
  // Quản lý cơ sở được tra cứu giáo viên/phụ huynh để phân công/liên kết (UC-04, UC-05)
  const lookup = actor.role === 'MANAGER' && ['TEACHER', 'PARENT'].includes(query.role)
  if (!lookup) need(actor, 'ADMIN')
  const q = fold(query.query || '')
  const rows = db.users
    .filter((u) => (!q || fold(`${u.fullName} ${u.email} ${u.phone || ''}`).includes(q)) && (!query.role || u.role === query.role) && (!query.status || u.status === query.status))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'))
  return paginate(rows, query)
})

route('POST', '/users', ({ db, actor, body }) => {
  need(actor, 'ADMIN')
  const fullName = (body.fullName || '').trim()
  const email = (body.email || '').trim().toLowerCase()
  if (!fullName) bad('Nhập họ tên.', 'fullName')
  if (!EMAIL_RE.test(email)) bad('Email không hợp lệ.', 'email')
  if ((body.temporaryPassword || '').length < 8) bad('Mật khẩu tạm tối thiểu 8 ký tự.', 'temporaryPassword')
  if (!ROLE_LIST.includes(body.role)) bad('Vai trò không hợp lệ.', 'role')
  if (db.users.some((u) => u.email === email)) throw new ApiError(409, 'EMAIL_EXISTS', 'Email này đã được sử dụng. Hãy nhập email khác.', 'email')
  const user = { id: uid(), fullName, email, phone: body.phone?.trim() || null, role: body.role, status: 'ACTIVE', createdAt: now() }
  db.users.push(user)
  db.credentials[email] = body.temporaryPassword // MOCK: backend thật phải băm rồi mới lưu
  audit(db, actor, 'CREATE_USER', 'user', user.id, { label: email, after: { fullName, email, role: user.role } })
  return user
})

route('PATCH', '/users/:id', ({ db, actor, params, body }) => {
  need(actor, 'ADMIN')
  const u = found(db.users.find((x) => x.id === params.id), 'tài khoản')
  const next = { fullName: body.fullName !== undefined ? body.fullName.trim() : u.fullName, phone: body.phone !== undefined ? (body.phone || '').trim() || null : u.phone }
  if (!next.fullName) bad('Nhập họ tên.', 'fullName')
  const { before, after } = diffObj(u, next)
  Object.assign(u, next)
  if (Object.keys(after).length) audit(db, actor, 'UPDATE_USER', 'user', u.id, { label: u.email, before, after })
  return u
})

route('PATCH', '/users/:id/role', ({ db, actor, params, body }) => {
  need(actor, 'ADMIN')
  const u = found(db.users.find((x) => x.id === params.id), 'tài khoản')
  if (!ROLE_LIST.includes(body.role)) bad('Vai trò không hợp lệ.', 'role')
  if (u.role !== body.role) audit(db, actor, 'CHANGE_ROLE', 'user', u.id, { label: u.email, before: { role: u.role }, after: { role: body.role } })
  u.role = body.role
  return u
})

route('PATCH', '/users/:id/status', ({ db, actor, params, body }) => {
  need(actor, 'ADMIN')
  const u = found(db.users.find((x) => x.id === params.id), 'tài khoản')
  if (!USER_STATUSES.includes(body.status)) bad('Trạng thái không hợp lệ.', 'status')
  if (isSelf(actor, u) && body.status !== 'ACTIVE') throw new ApiError(403, 'SELF_ACTION', 'Bạn không thể khóa hoặc ngừng hoạt động chính tài khoản đang dùng.')
  if (u.status !== body.status) audit(db, actor, 'CHANGE_STATUS', 'user', u.id, { label: u.email, before: { status: u.status }, after: { status: body.status } })
  u.status = body.status
  return u
})

route('GET', '/audit-logs', ({ db, actor, query }) => {
  need(actor, 'ADMIN')
  return paginate(db.auditLogs, query)
})

/* UC-05 — lớp học */
route('GET', '/classes', ({ db, actor, query }) => {
  need(actor, 'MANAGER', 'TEACHER', 'MEDICAL_STAFF')
  const mine = actor.role === 'TEACHER' ? teacherClassIds(db, actor) : null
  const rows = db.classes
    .filter((c) => (!mine || mine.includes(c.id)) && (!query.academicYear || c.academicYear.includes(query.academicYear)) && (!query.status || c.status === query.status))
    .sort((a, b) => b.academicYear.localeCompare(a.academicYear) || a.name.localeCompare(b.name, 'vi'))
  const p = paginate(rows, query)
  return { ...p, items: p.items.map((c) => outClass(db, c)) }
})

route('POST', '/classes', ({ db, actor, body }) => {
  need(actor, 'MANAGER')
  const name = (body.name || '').trim()
  const academicYear = (body.academicYear || '').trim()
  if (!name) bad('Nhập tên lớp.', 'name')
  if (academicYear.length < 4) bad('Nhập năm học, ví dụ 2026-2027.', 'academicYear')
  if (db.classes.some((c) => c.academicYear === academicYear && fold(c.name) === fold(name)))
    throw new ApiError(409, 'CLASS_NAME_EXISTS', 'Đã có lớp cùng tên trong năm học này. Hãy chọn tên khác.', 'name')
  const c = { id: uid(), name, academicYear, status: 'ACTIVE' }
  db.classes.push(c)
  audit(db, actor, 'CREATE_CLASS', 'class', c.id, { label: name, after: { name, academicYear } })
  return outClass(db, c)
})

route('GET', '/classes/:id', ({ db, actor, params }) => {
  need(actor, 'MANAGER', 'TEACHER')
  const c = found(db.classes.find((x) => x.id === params.id), 'lớp')
  classAccess(db, actor, c.id)
  return outClass(db, c)
})

// Danh sách trẻ đang học của lớp (giáo viên chỉ xem lớp mình phụ trách)
route('GET', '/classes/:id/children', ({ db, actor, params }) => {
  need(actor, 'MANAGER', 'TEACHER')
  const c = found(db.classes.find((x) => x.id === params.id), 'lớp')
  classAccess(db, actor, c.id)
  const items = db.children.filter((ch) => ch.classId === c.id && ch.status === 'ACTIVE').sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  return { items: items.map((ch) => outChild(db, ch)) }
})

route('PATCH', '/classes/:id', ({ db, actor, params, body }) => {
  need(actor, 'MANAGER')
  const c = found(db.classes.find((x) => x.id === params.id), 'lớp')
  const name = body.name !== undefined ? body.name.trim() : c.name
  const academicYear = body.academicYear !== undefined ? body.academicYear.trim() : c.academicYear
  if (!name) bad('Nhập tên lớp.', 'name')
  if (academicYear.length < 4) bad('Nhập năm học, ví dụ 2026-2027.', 'academicYear')
  if (db.classes.some((x) => x.id !== c.id && x.academicYear === academicYear && fold(x.name) === fold(name)))
    throw new ApiError(409, 'CLASS_NAME_EXISTS', 'Đã có lớp cùng tên trong năm học này. Hãy chọn tên khác.', 'name')
  let status = c.status
  if (body.status !== undefined) {
    if (!['ACTIVE', 'CLOSED'].includes(body.status)) bad('Trạng thái không hợp lệ.', 'status')
    if (body.status === 'CLOSED' && c.status !== 'CLOSED') {
      const n = activeChildCount(db, c.id)
      if (n > 0) throw new ApiError(409, 'CLASS_HAS_CHILDREN', `Lớp còn ${n} trẻ đang học. Hãy chuyển các bé sang lớp khác trước khi đóng lớp.`)
    }
    status = body.status
  }
  const { before, after } = diffObj(c, { name, academicYear, status })
  Object.assign(c, { name, academicYear, status })
  if (Object.keys(after).length) audit(db, actor, after.status === 'CLOSED' ? 'CLOSE_CLASS' : 'UPDATE_CLASS', 'class', c.id, { label: c.name, before, after })
  return outClass(db, c)
})

route('POST', '/classes/:id/teachers', ({ db, actor, params, body }) => {
  need(actor, 'MANAGER')
  const c = found(db.classes.find((x) => x.id === params.id), 'lớp')
  if (c.status !== 'ACTIVE') throw new ApiError(409, 'CLASS_CLOSED', 'Lớp đã đóng, không nhận phân công mới.')
  const ids = body.teacherUserIds
  if (!Array.isArray(ids) || ids.length === 0) bad('Chọn ít nhất một giáo viên.')
  const names = []
  for (const id of new Set(ids)) {
    const t = db.users.find((u) => u.id === id)
    if (!t || t.role !== 'TEACHER' || t.status !== 'ACTIVE') throw new ApiError(400, 'NOT_TEACHER', `${t?.fullName ?? 'Người dùng này'} không phải giáo viên đang hoạt động.`)
    if (db.classTeachers.some((x) => x.classId === c.id && x.teacherUserId === id)) throw new ApiError(409, 'ALREADY_ASSIGNED', `${t.fullName} đã được phân công vào lớp này.`)
    db.classTeachers.push({ classId: c.id, teacherUserId: id, assignedAt: now() })
    names.push(t.fullName)
  }
  audit(db, actor, 'ASSIGN_TEACHER', 'class', c.id, { label: c.name, after: { teacher: names.join(', ') } })
  return db.classTeachers.filter((x) => x.classId === c.id)
})

route('DELETE', '/classes/:id/teachers/:tid', ({ db, actor, params }) => {
  need(actor, 'MANAGER')
  const c = found(db.classes.find((x) => x.id === params.id), 'lớp')
  const i = db.classTeachers.findIndex((x) => x.classId === c.id && x.teacherUserId === params.tid)
  found(i >= 0 ? true : null, 'phân công')
  db.classTeachers.splice(i, 1)
  audit(db, actor, 'REMOVE_TEACHER', 'class', c.id, { label: c.name, before: { teacher: db.users.find((u) => u.id === params.tid)?.fullName } })
  return null
})

/* UC-04 — hồ sơ trẻ */
route('GET', '/children', ({ db, actor, query }) => {
  need(actor, 'MANAGER', 'MEDICAL_STAFF', 'PARENT')
  const mine = actor.role === 'PARENT' ? parentChildIds(db, actor) : null
  const q = fold(query.query || '')
  const rows = db.children
    .filter((c) => (!mine || mine.includes(c.id)) && (!q || fold(c.name).includes(q)) && (!query.classId || c.classId === query.classId) && (!query.status || c.status === query.status))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  const p = paginate(rows, query)
  return { ...p, items: p.items.map((c) => outChild(db, c)) }
})

route('POST', '/children', ({ db, actor, body }) => {
  need(actor, 'MANAGER')
  const name = (body.name || '').trim()
  if (!name) bad('Nhập họ tên trẻ.', 'name')
  if (!validDob(body.dateOfBirth)) bad('Ngày sinh không hợp lệ.', 'dateOfBirth')
  if (!GENDERS.includes(body.gender)) bad('Chọn giới tính.', 'gender')
  if (!body.classId) bad('Chọn lớp.', 'classId')
  activeClass(db, body.classId)
  const ch = { id: uid(), name, dateOfBirth: body.dateOfBirth, gender: body.gender, address: (body.address || '').trim() || null, avatarUrl: null, classId: body.classId, status: 'ACTIVE' }
  db.children.push(ch)
  audit(db, actor, 'CREATE_CHILD', 'child', ch.id, { label: name, after: childSnap(db, ch) })
  return outChild(db, ch)
})

route('GET', '/children/:id', ({ db, actor, params }) => {
  need(actor, 'MANAGER', 'MEDICAL_STAFF', 'PARENT')
  const ch = found(db.children.find((c) => c.id === params.id), 'hồ sơ trẻ')
  childAccess(db, actor, ch, ['MANAGER', 'MEDICAL_STAFF', 'PARENT']) // phụ huynh đổi id sang trẻ khác -> 404
  // Phụ huynh không cần thấy thông tin liên hệ của phụ huynh khác
  const out = outChild(db, ch, actor.role === 'MANAGER') // chỉ quản lý cần thông tin liên hệ phụ huynh
  return out
})

route('PATCH', '/children/:id', ({ db, actor, params, body }) => {
  need(actor, 'MANAGER')
  const ch = found(db.children.find((c) => c.id === params.id), 'hồ sơ trẻ')
  const before = childSnap(db, ch)
  const next = { ...ch }
  if (body.name !== undefined) { next.name = body.name.trim(); if (!next.name) bad('Nhập họ tên trẻ.', 'name') }
  if (body.dateOfBirth !== undefined) { if (!validDob(body.dateOfBirth)) bad('Ngày sinh không hợp lệ.', 'dateOfBirth'); next.dateOfBirth = body.dateOfBirth }
  if (body.gender !== undefined) { if (!GENDERS.includes(body.gender)) bad('Chọn giới tính.', 'gender'); next.gender = body.gender }
  if (body.address !== undefined) next.address = (body.address || '').trim() || null
  if (body.status !== undefined) { if (!CHILD_STATUSES.includes(body.status)) bad('Trạng thái không hợp lệ.', 'status'); next.status = body.status }
  if (body.classId !== undefined && body.classId !== ch.classId) { activeClass(db, body.classId); next.classId = body.classId }
  else if (next.status === 'ACTIVE' && ch.status !== 'ACTIVE') activeClass(db, ch.classId) // khôi phục phải về lớp đang hoạt động
  Object.assign(ch, next)
  const d = diffObj(before, childSnap(db, ch))
  if (Object.keys(d.after).length) audit(db, actor, 'UPDATE_CHILD', 'child', ch.id, { label: ch.name, ...d })
  return outChild(db, ch)
})

route('POST', '/children/:id/parents', ({ db, actor, params, body }) => {
  need(actor, 'MANAGER')
  const ch = found(db.children.find((c) => c.id === params.id), 'hồ sơ trẻ')
  const p = db.users.find((u) => u.id === body.parentUserId)
  if (!p || p.role !== 'PARENT' || p.status !== 'ACTIVE') throw new ApiError(400, 'NOT_PARENT', 'Tài khoản này không phải phụ huynh đang hoạt động.')
  if (!RELS.includes(body.relationship)) bad('Chọn quan hệ với trẻ.', 'relationship')
  if (db.childParents.some((l) => l.childId === ch.id && l.parentUserId === p.id)) throw new ApiError(409, 'PARENT_LINKED', `${p.fullName} đã liên kết với trẻ này.`)
  const link = { childId: ch.id, parentUserId: p.id, relationship: body.relationship }
  db.childParents.push(link)
  audit(db, actor, 'LINK_PARENT', 'child', ch.id, { label: ch.name, after: { parent: p.fullName, relationship: body.relationship } })
  return link
})

/* ---------- điểm vào ---------- */
export async function mockRequest(method, path, { query = {}, body } = {}) {
  await delay()
  const user = getSession()?.user
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.')
  for (const r of routes) {
    if (r.method !== method) continue
    const m = path.match(r.re)
    if (!m) continue
    const db = structuredClone(loadDb())
    const out = r.handler({ db, actor: { ...user, role: normRole(user.role) }, params: m.groups || {}, query, body: body || {} })
    saveDb(db) // chỉ ghi khi handler không ném lỗi
    return structuredClone(out)
  }
  throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy API.')
}
