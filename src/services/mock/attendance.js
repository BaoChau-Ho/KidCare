// UC-06 — Điểm danh (giáo viên) và lịch sử điểm danh của trẻ (dùng cho UC-07)
import { ApiError } from '../apiError.js'
import {
  route, need, found, bad, uid, now, audit, paginate, diffObj, me, classAccess, childAccess, notify, parentsOf,
  todayStr, nowTime, isDate, isTime, hhmm, recordOf, approvedLeave, lateStatus, isEarly, outAttendance, checkOutChild,
} from '../mockCore.js'

const STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EARLY_LEAVE']

const loadChild = (db, id) => found(db.children.find((c) => c.id === id), 'hồ sơ trẻ')
const teacherOnly = (db, actor, child) => {
  if (child.status !== 'ACTIVE') throw new ApiError(409, 'CHILD_NOT_ACTIVE', 'Trẻ không còn ở trạng thái đang học.')
  classAccess(db, actor, child.classId)
}
const pickDate = (body) => body.date || (body.checkInTime || body.checkOutTime || '').slice(0, 10) || todayStr()
const checkDate = (date) => {
  if (!isDate(date)) bad('Ngày không hợp lệ.', 'date')
  if (date > todayStr()) bad('Không thể điểm danh cho ngày trong tương lai.', 'date')
}

// Bảng điểm danh của lớp theo ngày
route('GET', '/classes/:id/attendance', ({ db, actor, params, query }) => {
  need(actor, 'TEACHER', 'MANAGER')
  const c = found(db.classes.find((x) => x.id === params.id), 'lớp')
  classAccess(db, actor, c.id)
  const date = query.date || todayStr()
  if (!isDate(date)) bad('Ngày không hợp lệ.', 'date')
  const items = db.children
    .filter((ch) => ch.classId === c.id && ch.status === 'ACTIVE')
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    .map((ch) => {
      const rec = recordOf(db, ch.id, date)
      const leave = approvedLeave(db, ch.id, date)
      return {
        childId: ch.id, name: ch.name, gender: ch.gender,
        attendanceId: rec?.id ?? null,
        status: rec ? rec.status : leave ? 'ABSENT' : 'NOT_CHECKED_IN',
        checkInTime: rec?.checkInTime ?? null,
        checkOutTime: rec?.checkOutTime ?? null,
        earlyLeave: rec ? isEarly(db, rec) : false,
        onLeave: !!leave, // có đơn nghỉ đã duyệt (UC-08)
      }
    })
  return { classId: c.id, className: c.name, date, settings: db.settings, items }
})

// Check-in (hoặc ghi vắng bằng status = ABSENT)
route('POST', '/attendance/check-in', ({ db, actor, body }) => {
  need(actor, 'TEACHER', 'MANAGER')
  const child = loadChild(db, body.childId)
  teacherOnly(db, actor, child)
  const date = pickDate(body)
  checkDate(date)
  if (recordOf(db, child.id, date)) throw new ApiError(409, 'ATTENDANCE_EXISTS', 'Trẻ đã có bản ghi điểm danh trong ngày này. Hãy dùng chức năng sửa.')

  const absent = body.status === 'ABSENT'
  let time = null
  if (!absent) {
    time = (body.checkInTime || '').slice(11, 16) || (date === todayStr() ? nowTime() : '')
    if (!isTime(time)) bad('Nhập giờ đến hợp lệ.', 'checkInTime')
    if (date === todayStr() && time > nowTime()) bad('Giờ đến không được ở tương lai.', 'checkInTime')
  }
  const rec = {
    id: uid(), childId: child.id, date, status: absent ? 'ABSENT' : lateStatus(db, time),
    checkInTime: time ? `${date}T${time}` : null, checkOutTime: null, recordedByUserId: me(db, actor).id, createdAt: now(), updatedAt: now(),
  }
  db.attendance.push(rec)
  audit(db, actor, absent ? 'MARK_ABSENT' : 'CHECK_IN', 'attendance', rec.id, { label: child.name, after: { status: rec.status, ...(time && { checkInTime: time }) } })
  notify(db, parentsOf(db, child.id), {
    type: 'ATTENDANCE', relatedType: 'child', relatedId: child.id,
    title: absent ? `${child.name} vắng mặt hôm nay` : `${child.name} đã đến lớp`,
    content: absent ? `Ngày ${date.split('-').reverse().join('/')}.` : `Giờ đến ${time}${rec.status === 'LATE' ? ' (muộn)' : ''}.`,
  })
  return outAttendance(db, rec)
})

// Check-out
route('POST', '/attendance/check-out', ({ db, actor, body }) => {
  need(actor, 'TEACHER', 'MANAGER')
  const child = loadChild(db, body.childId)
  teacherOnly(db, actor, child)
  const date = pickDate(body)
  checkDate(date)
  const time = (body.checkOutTime || '').slice(11, 16) || (date === todayStr() ? nowTime() : '')
  const rec = checkOutChild(db, actor, child, date, time)
  return outAttendance(db, rec)
})

// Sửa bản ghi (có audit trước/sau)
route('PATCH', '/attendance/:id', ({ db, actor, params, body }) => {
  need(actor, 'TEACHER', 'MANAGER')
  const rec = found(db.attendance.find((a) => a.id === params.id), 'bản ghi điểm danh')
  const child = loadChild(db, rec.childId)
  classAccess(db, actor, child.classId)

  const before = { status: rec.status, checkInTime: hhmm(rec.checkInTime) || null, checkOutTime: hhmm(rec.checkOutTime) || null }
  let status = body.status ?? rec.status
  if (!STATUSES.includes(status)) bad('Trạng thái không hợp lệ.', 'status')
  let inT = 'checkInTime' in body ? (body.checkInTime ? body.checkInTime.slice(11, 16) : null) : before.checkInTime
  let outT = 'checkOutTime' in body ? (body.checkOutTime ? body.checkOutTime.slice(11, 16) : null) : before.checkOutTime

  if (status === 'ABSENT') { inT = null; outT = null }
  else {
    if (!isTime(inT)) bad('Nhập giờ đến hợp lệ.', 'checkInTime')
    if (outT && !isTime(outT)) bad('Giờ về không hợp lệ.', 'checkOutTime')
    if (outT && outT < inT) bad('Giờ về phải sau giờ đến.', 'checkOutTime')
    if (rec.date === todayStr() && (inT > nowTime() || (outT && outT > nowTime()))) bad('Giờ không được ở tương lai.', 'checkInTime')
    if (!('status' in body) || body.status === undefined) status = lateStatus(db, inT)
    else if (status === 'PRESENT' || status === 'LATE') status = lateStatus(db, inT)
  }
  Object.assign(rec, { status, checkInTime: inT ? `${rec.date}T${inT}` : null, checkOutTime: outT ? `${rec.date}T${outT}` : null, updatedAt: now() })
  const { before: b, after: a } = diffObj(before, { status, checkInTime: inT, checkOutTime: outT })
  if (Object.keys(a).length) audit(db, actor, 'UPDATE_ATTENDANCE', 'attendance', rec.id, { label: child.name, before: b, after: a })
  return outAttendance(db, rec)
})

// Trạng thái hôm nay của một bé (phụ huynh, giáo viên, quản lý)
route('GET', '/children/:id/attendance/today', ({ db, actor, params }) => {
  need(actor, 'PARENT', 'TEACHER', 'MANAGER')
  const child = loadChild(db, params.id)
  childAccess(db, actor, child)
  const date = todayStr()
  const rec = recordOf(db, child.id, date)
  const leave = approvedLeave(db, child.id, date)
  return {
    childId: child.id, date, status: rec ? rec.status : leave ? 'ABSENT' : 'NOT_CHECKED_IN',
    checkInTime: rec?.checkInTime ?? null, checkOutTime: rec?.checkOutTime ?? null,
    earlyLeave: rec ? isEarly(db, rec) : false, onLeave: !!leave,
  }
})

// Lịch sử điểm danh theo khoảng ngày, có phân trang
route('GET', '/children/:id/attendance', ({ db, actor, params, query }) => {
  need(actor, 'PARENT', 'TEACHER', 'MANAGER')
  const child = loadChild(db, params.id)
  childAccess(db, actor, child)
  if (query.from && !isDate(query.from)) bad('Ngày bắt đầu không hợp lệ.', 'from')
  if (query.to && !isDate(query.to)) bad('Ngày kết thúc không hợp lệ.', 'to')
  if (query.from && query.to && query.from > query.to) bad('Ngày bắt đầu phải trước ngày kết thúc.', 'from')
  const rows = db.attendance
    .filter((a) => a.childId === child.id && (!query.from || a.date >= query.from) && (!query.to || a.date <= query.to))
    .sort((x, y) => y.date.localeCompare(x.date))
  const p = paginate(rows, query)
  return { ...p, items: p.items.map((r) => outAttendance(db, r)) }
})
