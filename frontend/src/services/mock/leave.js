// UC-08 — Đơn xin nghỉ học
import { ApiError } from '../apiError.js'
import {
  route, need, found, bad, uid, now, audit, paginate, me, classAccess, childAccess, notify, teachersOfClass,
  teacherClassIds, userName, todayStr, isDate,
} from '../mockCore.js'

const fmt = (d) => d.split('-').reverse().join('/')

const out = (db, l) => {
  const ch = db.children.find((c) => c.id === l.childId)
  return {
    ...l, childName: ch?.name ?? null, className: db.classes.find((c) => c.id === ch?.classId)?.name ?? null,
    parentName: userName(db, l.parentUserId), decidedByName: userName(db, l.decidedByUserId),
  }
}
const visible = (db, actor) => {
  if (actor.role === 'PARENT') return (l) => l.parentUserId === me(db, actor).id
  if (actor.role === 'TEACHER') {
    const mine = teacherClassIds(db, actor)
    return (l) => mine.includes(db.children.find((c) => c.id === l.childId)?.classId)
  }
  return () => true // MANAGER
}

route('POST', '/leave-requests', ({ db, actor, body }) => {
  need(actor, 'PARENT')
  const child = found(db.children.find((c) => c.id === body.childId), 'hồ sơ trẻ')
  childAccess(db, actor, child, ['PARENT']) // chỉ gửi cho con đã liên kết
  const reason = (body.reason || '').trim()
  if (!isDate(body.fromDate)) bad('Chọn ngày bắt đầu.', 'fromDate')
  if (!isDate(body.toDate)) bad('Chọn ngày kết thúc.', 'toDate')
  if (body.fromDate < todayStr()) bad('Không thể xin nghỉ cho ngày đã qua.', 'fromDate')
  if (body.toDate < body.fromDate) bad('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.', 'toDate')
  if (!reason) bad('Nhập lý do xin nghỉ.', 'reason')
  if (reason.length > 1000) bad('Lý do tối đa 1000 ký tự.', 'reason')
  const overlap = db.leaveRequests.find((l) => l.childId === child.id && ['PENDING', 'APPROVED'].includes(l.status) && l.fromDate <= body.toDate && body.fromDate <= l.toDate)
  if (overlap) throw new ApiError(409, 'LEAVE_OVERLAP', `Đã có đơn nghỉ ${fmt(overlap.fromDate)} - ${fmt(overlap.toDate)} trùng với khoảng ngày này.`, 'fromDate')

  const l = { id: uid(), childId: child.id, parentUserId: me(db, actor).id, fromDate: body.fromDate, toDate: body.toDate, reason, status: 'PENDING', decidedByUserId: null, decidedAt: null, decisionReason: null, createdAt: now() }
  db.leaveRequests.push(l)
  audit(db, actor, 'CREATE_LEAVE', 'leave', l.id, { label: child.name, after: { from: l.fromDate, to: l.toDate } })
  notify(db, teachersOfClass(db, child.classId), {
    type: 'LEAVE', relatedType: 'leave', relatedId: l.id, title: `Đơn xin nghỉ của ${child.name}`, content: `Nghỉ từ ${fmt(l.fromDate)} đến ${fmt(l.toDate)}.`,
  })
  return out(db, l)
})

route('GET', '/leave-requests', ({ db, actor, query }) => {
  need(actor, 'PARENT', 'TEACHER', 'MANAGER')
  const ok = visible(db, actor)
  const rows = db.leaveRequests
    .filter((l) => ok(l) && (!query.status || l.status === query.status) && (!query.childId || l.childId === query.childId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const p = paginate(rows, query)
  return { ...p, items: p.items.map((l) => out(db, l)) }
})

const decide = (kind) => ({ db, actor, params, body }) => {
  need(actor, 'TEACHER', 'MANAGER')
  const l = found(db.leaveRequests.find((x) => x.id === params.id), 'đơn xin nghỉ')
  const child = db.children.find((c) => c.id === l.childId)
  classAccess(db, actor, child.classId)
  if (l.status !== 'PENDING') throw new ApiError(409, 'ALREADY_PROCESSED', 'Đơn này đã được xử lý.')
  const reason = (body.reason || '').trim()
  if (kind === 'REJECTED' && !reason) bad('Nhập lý do từ chối.', 'reason')
  Object.assign(l, { status: kind, decidedByUserId: me(db, actor).id, decidedAt: now(), decisionReason: reason || null })
  audit(db, actor, kind === 'APPROVED' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE', 'leave', l.id, { label: child.name, before: { status: 'PENDING' }, after: { status: kind } })
  notify(db, [l.parentUserId], {
    type: 'LEAVE', relatedType: 'leave', relatedId: l.id,
    title: kind === 'APPROVED' ? `Đơn xin nghỉ của ${child.name} đã được duyệt` : `Đơn xin nghỉ của ${child.name} bị từ chối`,
    content: kind === 'REJECTED' ? `Lý do: ${reason}` : `Nghỉ từ ${fmt(l.fromDate)} đến ${fmt(l.toDate)}.`,
  })
  return out(db, l)
}
route('POST', '/leave-requests/:id/approve', decide('APPROVED'))
route('POST', '/leave-requests/:id/reject', decide('REJECTED'))

// Phụ huynh rút đơn khi còn PENDING
route('PATCH', '/leave-requests/:id/cancel', ({ db, actor, params }) => {
  need(actor, 'PARENT')
  const l = db.leaveRequests.find((x) => x.id === params.id && x.parentUserId === me(db, actor).id)
  found(l, 'đơn xin nghỉ')
  if (l.status !== 'PENDING') throw new ApiError(409, 'ALREADY_PROCESSED', 'Chỉ rút được đơn đang chờ duyệt.')
  l.status = 'CANCELLED'
  audit(db, actor, 'CANCEL_LEAVE', 'leave', l.id, { label: db.children.find((c) => c.id === l.childId)?.name })
  return out(db, l)
})
