// UC-13 (giáo viên gửi thông báo) và UC-14 (xem thông báo của chính mình)
import { ApiError } from '../apiError.js'
import { route, need, found, bad, now, audit, paginate, me, classAccess, notify, parentsOf } from '../mockCore.js'

const out = (n) => ({ ...n, isRead: !!n.readAt })

// Người nhận luôn lấy từ phiên đăng nhập, không bao giờ nhận recipient id từ client
const mine = (db, actor) => db.notifications.filter((n) => n.recipientUserId === me(db, actor).id)

route('GET', '/notifications', ({ db, actor, query }) => {
  const rows = mine(db, actor).filter((n) => query.unread !== 'true' || !n.readAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const p = paginate(rows, query)
  return { ...p, items: p.items.map(out) }
})
route('GET', '/notifications/unread-count', ({ db, actor }) => ({ unreadCount: mine(db, actor).filter((n) => !n.readAt).length }))

// Idempotent: đánh dấu lại một thông báo đã đọc không đổi thời điểm đọc
route('PATCH', '/notifications/:id/read', ({ db, actor, params }) => {
  const n = found(mine(db, actor).find((x) => x.id === params.id), 'thông báo') // của người khác -> 404
  if (!n.readAt) n.readAt = now()
  return out(n)
})
route('POST', '/notifications/read-all', ({ db, actor }) => {
  let changed = 0
  for (const n of mine(db, actor)) if (!n.readAt) { n.readAt = now(); changed += 1 }
  return { updated: changed }
})

route('POST', '/notifications/broadcast', ({ db, actor, body }) => {
  need(actor, 'TEACHER')
  const title = (body.title || '').trim(), content = (body.content || '').trim()
  if (!title) bad('Nhập tiêu đề.', 'title')
  if (title.length > 200) bad('Tiêu đề tối đa 200 ký tự.', 'title')
  if (!content) bad('Nhập nội dung.', 'content')
  if (content.length > 5000) bad('Nội dung tối đa 5000 ký tự.', 'content')
  const cls = found(db.classes.find((c) => c.id === body.classId), 'lớp')
  classAccess(db, actor, cls.id) // không gửi được cho lớp ngoài phân công
  let kids = db.children.filter((c) => c.classId === cls.id && c.status === 'ACTIVE')
  if (Array.isArray(body.childIds) && body.childIds.length) {
    const set = new Set(body.childIds)
    if ([...set].some((id) => !kids.some((c) => c.id === id))) throw new ApiError(403, 'FORBIDDEN', 'Có trẻ không thuộc lớp bạn phụ trách.')
    kids = kids.filter((c) => set.has(c.id))
  }
  const recipients = [...new Set(kids.flatMap((c) => parentsOf(db, c.id)))] // khử trùng người nhận (phụ huynh có nhiều con)
  if (recipients.length === 0) throw new ApiError(409, 'NO_RECIPIENTS', 'Không có phụ huynh nào để nhận thông báo này. Hãy liên kết phụ huynh với trẻ trước.')
  notify(db, recipients, { senderUserId: me(db, actor).id, type: 'ANNOUNCEMENT', relatedType: 'class', relatedId: cls.id, title, content })
  audit(db, actor, 'BROADCAST', 'class', cls.id, { label: cls.name, after: { recipients: recipients.length } })
  return { recipientCount: recipients.length, notificationCount: recipients.length }
})
