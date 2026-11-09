// Phần lõi dùng chung của mock server: hằng số, hàm tiện ích, kiểm tra quyền, bộ định tuyến.
import { ApiError } from './apiError.js'
export { todayStr, nowTime, isDate, isTime, addDays, hhmm, daysBetween, isWeekend, pad } from './dates.js'
import { todayStr, nowTime, isTime, hhmm } from './dates.js'

export const ROLE_LIST = ['ADMIN', 'MANAGER', 'TEACHER', 'MEDICAL_STAFF', 'PARENT']
export const USER_STATUSES = ['ACTIVE', 'LOCKED', 'INACTIVE']
export const CHILD_STATUSES = ['ACTIVE', 'INACTIVE', 'WITHDRAWN']
export const GENDERS = ['MALE', 'FEMALE', 'OTHER']
export const RELS = ['FATHER', 'MOTHER', 'GUARDIAN']
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const delay = (ms = 200) => new Promise((r) => setTimeout(r, globalThis.__MOCK_DELAY__ ?? ms))
export const uid = () => crypto.randomUUID()
export const now = () => new Date().toISOString()
export const fold = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')

/* ---------- tiện ích ---------- */
export const bad = (message, field) => { throw new ApiError(400, 'VALIDATION', message, field) }
export const found = (x, what) => { if (!x) throw new ApiError(404, 'NOT_FOUND', `Không tìm thấy ${what}.`); return x }
export const need = (actor, ...roles) => {
  if (!roles.includes(actor.role)) throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.')
}
export const paginate = (items, q) => {
  const page = Math.max(1, +q.page || 1)
  const limit = Math.min(100, Math.max(1, +q.limit || 10))
  return { items: items.slice((page - 1) * limit, page * limit), pageInfo: { page, limit, totalItems: items.length, totalPages: Math.ceil(items.length / limit) } }
}
export const audit = (db, actor, action, resourceType, resourceId, extra = {}) =>
  db.auditLogs.unshift({ id: uid(), actorEmail: actor.email, action, resourceType, resourceId, ...extra, at: now() })
export const diffObj = (a, b) => {
  const before = {}, after = {}
  for (const k of Object.keys(b)) if (a[k] !== b[k]) { before[k] = a[k]; after[k] = b[k] }
  return { before, after }
}
export const isSelf = (actor, user) => user.email.toLowerCase() === String(actor.email || '').toLowerCase()
export const className = (db, id) => db.classes.find((c) => c.id === id)?.name ?? null
export const activeClass = (db, id) => {
  const c = db.classes.find((x) => x.id === id)
  if (!c || c.status !== 'ACTIVE') throw new ApiError(409, 'CLASS_NOT_AVAILABLE', 'Lớp không tồn tại hoặc đã đóng. Hãy chọn lớp khác.', 'classId')
  return c
}
export const activeChildCount = (db, classId) => db.children.filter((c) => c.classId === classId && c.status === 'ACTIVE').length

export const outClass = (db, c) => {
  const links = db.classTeachers.filter((x) => x.classId === c.id)
  return {
    ...c,
    teacherUserIds: links.map((l) => l.teacherUserId),
    teachers: links.map((l) => {
      const u = db.users.find((x) => x.id === l.teacherUserId)
      return { id: l.teacherUserId, fullName: u?.fullName ?? '', email: u?.email ?? '' } // dạng của backend Stage 2
    }),
    childCount: activeChildCount(db, c.id),
  }
}
export const outChild = (db, ch, withParents = false) => {
  const links = db.childParents.filter((l) => l.childId === ch.id)
  return {
    ...ch,
    className: className(db, ch.classId),
    parentUserIds: links.map((l) => l.parentUserId),
    ...(withParents && {
      parents: links.map((l) => {
        const u = db.users.find((x) => x.id === l.parentUserId)
        return { parentUserId: l.parentUserId, fullName: u?.fullName ?? u?.email ?? '', relationship: l.relationship } // dạng của backend Stage 2
      }),
    }),
  }
}
export const childSnap = (db, ch) => ({ name: ch.name, dateOfBirth: ch.dateOfBirth, gender: ch.gender, address: ch.address || '', class: className(db, ch.classId), status: ch.status })
export const validDob = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s)) && Date.parse(s) <= Date.now()


/* ---------- bộ định tuyến ---------- */
export const routes = []
export const route = (method, pattern, handler) =>
  routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler })

/* ---------- ai là ai ---------- */
export const me = (db, actor) => {
  const u = db.users.find((x) => x.email.toLowerCase() === String(actor.email || '').toLowerCase())
  if (!u) throw new ApiError(403, 'FORBIDDEN', 'Không tìm thấy tài khoản của bạn trong hệ thống.')
  return u
}
export const teacherClassIds = (db, actor) => db.classTeachers.filter((x) => x.teacherUserId === me(db, actor).id).map((x) => x.classId)
export const isTeacherOf = (db, actor, classId) => teacherClassIds(db, actor).includes(classId)
export const parentChildIds = (db, actor) => db.childParents.filter((l) => l.parentUserId === me(db, actor).id).map((l) => l.childId)
export const parentsOf = (db, childId) => db.childParents.filter((l) => l.childId === childId).map((l) => l.parentUserId)
export const teachersOfClass = (db, classId) => db.classTeachers.filter((x) => x.classId === classId).map((x) => x.teacherUserId)
export const userName = (db, id) => db.users.find((u) => u.id === id)?.fullName ?? null

// TEACHER phải được phân công, MANAGER tự do (nếu route cho phép vai trò đó)
export function classAccess(db, actor, classId) {
  if (actor.role === 'MANAGER') return
  if (actor.role === 'TEACHER' && isTeacherOf(db, actor, classId)) return
  throw new ApiError(403, 'FORBIDDEN', 'Bạn không phụ trách lớp này.')
}
// Chống IDOR: dữ liệu không thuộc về người hỏi thì trả 403 CHILD_ACCESS_DENIED (giống backend Stage 2)
export function childAccess(db, actor, child, roles = ['MANAGER', 'PARENT', 'TEACHER']) {
  const r = actor.role
  const ok = roles.includes(r) && (
    r === 'MANAGER' || r === 'MEDICAL_STAFF' ||
    (r === 'PARENT' && parentChildIds(db, actor).includes(child.id)) ||
    (r === 'TEACHER' && isTeacherOf(db, actor, child.classId)))
  if (!ok) throw new ApiError(403, 'CHILD_ACCESS_DENIED', 'Bạn không được truy cập hồ sơ trẻ này.')
}

/* ---------- thông báo (UC-13/14) ---------- */
export const notify = (db, userIds, n) => {
  for (const id of new Set(userIds)) {
    db.notifications.unshift({
      id: uid(), recipientUserId: id, senderUserId: n.senderUserId ?? null, type: n.type, title: n.title, content: n.content ?? '',
      relatedType: n.relatedType ?? null, relatedId: n.relatedId ?? null, channel: 'IN_APP', createdAt: now(), readAt: null,
    })
  }
}

/* ---------- điểm danh (UC-06) dùng chung với đón trẻ (UC-12) ---------- */
export const recordOf = (db, childId, date) => db.attendance.find((a) => a.childId === childId && a.date === date)
export const approvedLeave = (db, childId, date) =>
  db.leaveRequests.find((l) => l.childId === childId && l.status === 'APPROVED' && l.fromDate <= date && date <= l.toDate)
export const lateStatus = (db, time) => (time > db.settings.startTime ? 'LATE' : 'PRESENT')
export const isEarly = (db, rec) => !!rec.checkOutTime && hhmm(rec.checkOutTime) < db.settings.endTime && rec.status !== 'ABSENT'
export const outAttendance = (db, rec) => ({ ...rec, earlyLeave: isEarly(db, rec) })

export function checkOutChild(db, actor, child, date, time) {
  const rec = recordOf(db, child.id, date)
  if (!rec || rec.status === 'ABSENT' || !rec.checkInTime) throw new ApiError(409, 'NOT_CHECKED_IN', 'Trẻ chưa được check-in nên không thể check-out.')
  if (rec.checkOutTime) throw new ApiError(409, 'ALREADY_CHECKED_OUT', 'Trẻ đã được check-out rồi.')
  if (!isTime(time)) bad('Giờ về không hợp lệ.', 'time')
  if (date === todayStr() && time > nowTime()) bad('Giờ về không được ở tương lai.', 'time')
  if (time < hhmm(rec.checkInTime)) bad('Giờ về phải sau giờ đến.', 'time')
  rec.checkOutTime = `${date}T${time}`
  rec.updatedAt = now()
  audit(db, actor, 'CHECK_OUT', 'attendance', rec.id, { label: child.name, after: { checkOutTime: time } })
  notify(db, parentsOf(db, child.id), {
    type: 'ATTENDANCE', title: `${child.name} đã ra về`, content: `Giờ về ${time}.`, relatedType: 'child', relatedId: child.id,
  })
  return rec
}
