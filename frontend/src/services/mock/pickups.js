// UC-11 (phụ huynh đăng ký người đón) và UC-12 (giáo viên xác nhận, ghi check-out)
import { ApiError } from '../apiError.js'
import {
  route, need, found, bad, uid, now, audit, paginate, me, classAccess, childAccess, notify, parentsOf, teachersOfClass,
  teacherClassIds, userName, todayStr, nowTime, recordOf, checkOutChild,
} from '../mockCore.js'

const ID_RE = /^\d{9}$|^\d{12}$/ // CMND 9 số hoặc CCCD 12 số
const PHONE_RE = /^\+?\d{9,12}$/
const mask = (s) => (s ? '\u2022'.repeat(Math.max(0, s.length - 4)) + s.slice(-4) : null)
const fmtDT = (s) => `${s.slice(11, 16)} ${s.slice(0, 10).split('-').reverse().join('/')}`

// Giấy tờ chỉ lộ cho giáo viên đúng lớp; phụ huynh và quản lý chỉ thấy 4 số cuối
const out = (db, actor, p) => {
  const ch = db.children.find((c) => c.id === p.childId)
  const full = actor.role === 'TEACHER'
  return {
    ...p, idNumber: full ? p.idNumber : mask(p.idNumber), childName: ch?.name ?? null,
    className: db.classes.find((c) => c.id === ch?.classId)?.name ?? null,
    requesterName: userName(db, p.requesterUserId), verifiedByName: userName(db, p.verifiedByTeacherUserId),
  }
}
const visible = (db, actor) => {
  if (actor.role === 'PARENT') return (p) => p.requesterUserId === me(db, actor).id
  if (actor.role === 'TEACHER') {
    const mine = teacherClassIds(db, actor)
    return (p) => mine.includes(db.children.find((c) => c.id === p.childId)?.classId)
  }
  return () => true
}

route('POST', '/pickup-requests', ({ db, actor, body }) => {
  need(actor, 'PARENT')
  const child = found(db.children.find((c) => c.id === body.childId), 'hồ sơ trẻ')
  childAccess(db, actor, child, ['PARENT'])
  if (child.status !== 'ACTIVE') throw new ApiError(409, 'CHILD_NOT_ACTIVE', 'Trẻ không còn ở trạng thái đang học.')
  const pickupPerson = (body.pickupPerson || '').trim()
  const relationship = (body.relationship || '').trim()
  if (!pickupPerson) bad('Nhập họ tên người đón.', 'pickupPerson')
  if (!relationship) bad('Chọn quan hệ với trẻ.', 'relationship')
  if (!ID_RE.test((body.idNumber || '').trim())) bad('Số giấy tờ phải gồm 9 hoặc 12 chữ số.', 'idNumber')
  if (body.phone && !PHONE_RE.test(body.phone.replace(/\s/g, ''))) bad('Số điện thoại không hợp lệ.', 'phone')
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(body.expectedTime || '')) bad('Chọn thời gian dự kiến.', 'expectedTime')
  const expected = body.expectedTime.slice(0, 16)
  if (expected < `${todayStr()}T${nowTime()}`) bad('Thời gian dự kiến không được ở quá khứ.', 'expectedTime')

  const p = {
    id: uid(), childId: child.id, requesterUserId: me(db, actor).id, pickupPerson, relationship, idNumber: body.idNumber.trim(),
    phone: (body.phone || '').replace(/\s/g, '') || null, expectedTime: expected, status: 'PENDING',
    verifiedByTeacherUserId: null, decisionReason: null, decidedAt: null, completedAt: null, createdAt: now(),
  }
  db.pickupRequests.push(p)
  audit(db, actor, 'CREATE_PICKUP', 'pickup', p.id, { label: child.name, after: { person: pickupPerson, time: fmtDT(expected) } })
  notify(db, teachersOfClass(db, child.classId), { type: 'PICKUP', relatedType: 'pickup', relatedId: p.id, title: `Đăng ký người đón ${child.name}`, content: `Dự kiến ${fmtDT(expected)}.` })
  return out(db, actor, p)
})

route('GET', '/pickup-requests', ({ db, actor, query }) => {
  need(actor, 'PARENT', 'TEACHER')
  const ok = visible(db, actor)
  const rows = db.pickupRequests
    .filter((p) => ok(p) && (!query.status || p.status === query.status) && (!query.date || p.expectedTime.startsWith(query.date)))
    .sort((a, b) => a.expectedTime.localeCompare(b.expectedTime))
  const pg = paginate(rows, query)
  return { ...pg, items: pg.items.map((p) => out(db, actor, p)) }
})

route('PATCH', '/pickup-requests/:id/cancel', ({ db, actor, params }) => {
  need(actor, 'PARENT')
  const p = found(db.pickupRequests.find((x) => x.id === params.id && x.requesterUserId === me(db, actor).id), 'yêu cầu đón trẻ')
  if (p.status !== 'PENDING') throw new ApiError(409, 'ALREADY_PROCESSED', 'Chỉ hủy được yêu cầu đang chờ xác minh.')
  p.status = 'CANCELLED'
  audit(db, actor, 'CANCEL_PICKUP', 'pickup', p.id, { label: db.children.find((c) => c.id === p.childId)?.name })
  return out(db, actor, p)
})

// Chuyển trạng thái nguyên tử: kiểm tra trạng thái hiện tại rồi mới đổi
const transition = (from, to, apply) => ({ db, actor, params, body }) => {
  need(actor, 'TEACHER')
  const p = found(db.pickupRequests.find((x) => x.id === params.id), 'yêu cầu đón trẻ')
  const child = db.children.find((c) => c.id === p.childId)
  classAccess(db, actor, child.classId)
  if (p.status !== from) throw new ApiError(409, 'ALREADY_PROCESSED', p.status === to ? 'Yêu cầu này đã được xử lý rồi.' : `Yêu cầu đang ở trạng thái không hợp lệ để thực hiện thao tác này.`)
  apply({ db, actor, p, child, body })
  p.status = to
  return out(db, actor, p)
}

route('PATCH', '/pickup-requests/:id/approve', transition('PENDING', 'APPROVED', ({ db, actor, p, child }) => {
  Object.assign(p, { verifiedByTeacherUserId: me(db, actor).id, decidedAt: now() })
  audit(db, actor, 'APPROVE_PICKUP', 'pickup', p.id, { label: child.name, before: { status: 'PENDING' }, after: { status: 'APPROVED' } })
  notify(db, parentsOf(db, child.id), { type: 'PICKUP', relatedType: 'pickup', relatedId: p.id, title: `Người đón ${child.name} đã được xác minh`, content: `${p.pickupPerson} sẽ đón bé lúc ${fmtDT(p.expectedTime)}.` })
}))

route('PATCH', '/pickup-requests/:id/reject', transition('PENDING', 'REJECTED', ({ db, actor, p, child, body }) => {
  const reason = (body.reason || '').trim()
  if (!reason) bad('Nhập lý do từ chối.', 'reason')
  Object.assign(p, { verifiedByTeacherUserId: me(db, actor).id, decidedAt: now(), decisionReason: reason })
  audit(db, actor, 'REJECT_PICKUP', 'pickup', p.id, { label: child.name, before: { status: 'PENDING' }, after: { status: 'REJECTED' } })
  notify(db, parentsOf(db, child.id), { type: 'PICKUP', relatedType: 'pickup', relatedId: p.id, title: `Yêu cầu người đón ${child.name} bị từ chối`, content: `Lý do: ${reason}` })
}))

// Hoàn tất: check-out trẻ và đổi trạng thái trong cùng một lần; hoàn tất lần hai bị chặn bởi kiểm tra trạng thái
route('PATCH', '/pickup-requests/:id/complete', transition('APPROVED', 'COMPLETED', ({ db, actor, p, child }) => {
  const today = todayStr()
  if (p.expectedTime.slice(0, 10) !== today) throw new ApiError(409, 'NOT_TODAY', 'Chỉ giao trẻ được cho yêu cầu của hôm nay.')
  if (!recordOf(db, child.id, today)) throw new ApiError(409, 'NOT_CHECKED_IN', 'Trẻ chưa được check-in hôm nay nên không thể giao trẻ.')
  checkOutChild(db, actor, child, today, nowTime())
  p.completedAt = now()
  audit(db, actor, 'COMPLETE_PICKUP', 'pickup', p.id, { label: child.name, before: { status: 'APPROVED' }, after: { status: 'COMPLETED' } })
  notify(db, parentsOf(db, child.id), { type: 'PICKUP', relatedType: 'pickup', relatedId: p.id, title: `${child.name} đã được giao cho người đón`, content: `Người đón: ${p.pickupPerson}.` })
}))
