// UC-10 — Hoạt động của lớp (giáo viên tạo, phụ huynh xem)
import { ApiError } from '../apiError.js'
import {
  route, need, found, bad, uid, now, audit, paginate, me, classAccess, childAccess, notify, parentsOf, teacherClassIds,
  todayStr, isDate, userName,
} from '../mockCore.js'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 2 * 1024 * 1024 // dung lượng ảnh gốc tối đa
const MAX_IMAGES = 6
const MAX_DATA_URL = 400 * 1024 // mock lưu ảnh đã thu nhỏ trong localStorage nên giới hạn chặt hơn

const out = (db, a) => ({
  ...a,
  className: db.classes.find((c) => c.id === a.classId)?.name ?? null,
  createdByName: userName(db, a.createdByTeacherUserId),
  participants: db.activityParticipants.filter((p) => p.activityId === a.id).map((p) => ({ ...p, childName: db.children.find((c) => c.id === p.childId)?.name ?? null })),
  images: db.activityImages.filter((i) => i.activityId === a.id).map(({ id, objectKey, url, name }) => ({ id, objectKey, url, name })),
})

function addParticipants(db, activity, participants) {
  const added = []
  const ids = (participants || []).filter((p) => (p.participationStatus ?? 'JOINED') === 'JOINED').map((p) => p.childId)
  for (const id of new Set(ids)) {
    const ch = db.children.find((c) => c.id === id)
    if (!ch || ch.classId !== activity.classId || ch.status !== 'ACTIVE') throw new ApiError(400, 'VALIDATION', 'Có trẻ không thuộc lớp này hoặc không còn đang học.', 'participants')
    if (db.activityParticipants.some((p) => p.activityId === activity.id && p.childId === id)) continue
    db.activityParticipants.push({ activityId: activity.id, childId: id, participationStatus: 'JOINED' })
    added.push(ch)
  }
  return added
}
const notifyParents = (db, activity, children) => {
  for (const ch of children) {
    notify(db, parentsOf(db, ch.id), { type: 'ACTIVITY', relatedType: 'activity', relatedId: activity.id, title: `${ch.name} tham gia hoạt động "${activity.title}"`, content: 'Mở mục Hoạt động để xem chi tiết.' })
  }
}

route('GET', '/activities', ({ db, actor, query }) => {
  need(actor, 'TEACHER', 'MANAGER')
  const mine = actor.role === 'TEACHER' ? teacherClassIds(db, actor) : null
  if (query.classId && actor.role === 'TEACHER' && !mine.includes(query.classId)) throw new ApiError(403, 'FORBIDDEN', 'Bạn không phụ trách lớp này.')
  const rows = db.activities
    .filter((a) => (!mine || mine.includes(a.classId)) && (!query.classId || a.classId === query.classId))
    .sort((x, y) => y.date.localeCompare(x.date) || y.createdAt.localeCompare(x.createdAt))
  const p = paginate(rows, query)
  return { ...p, items: p.items.map((a) => out(db, a)) }
})

// Tạo hoạt động và participants trong cùng một "transaction" (lỗi thì không lưu gì)
route('POST', '/activities', ({ db, actor, body }) => {
  need(actor, 'TEACHER')
  const cls = found(db.classes.find((c) => c.id === body.classId), 'lớp')
  classAccess(db, actor, cls.id)
  if (cls.status !== 'ACTIVE') throw new ApiError(409, 'CLASS_CLOSED', 'Lớp đã đóng, không thể tạo hoạt động.')
  const title = (body.title || '').trim()
  if (!title) bad('Nhập tiêu đề hoạt động.', 'title')
  if (title.length > 200) bad('Tiêu đề tối đa 200 ký tự.', 'title')
  if (!isDate(body.date)) bad('Chọn ngày diễn ra.', 'date')
  if (body.date > todayStr()) bad('Chỉ ghi nhận hoạt động đã hoặc đang diễn ra hôm nay.', 'date')
  const a = { id: uid(), classId: cls.id, createdByTeacherUserId: me(db, actor).id, title, description: (body.description || '').trim() || null, date: body.date, createdAt: now() }
  db.activities.push(a)
  const added = addParticipants(db, a, body.participants)
  audit(db, actor, 'CREATE_ACTIVITY', 'activity', a.id, { label: title, after: { class: cls.name, participants: added.length } })
  notifyParents(db, a, added)
  return out(db, a)
})

route('POST', '/activities/:id/participants', ({ db, actor, params, body }) => {
  need(actor, 'TEACHER')
  const a = found(db.activities.find((x) => x.id === params.id), 'hoạt động')
  classAccess(db, actor, a.classId)
  const added = addParticipants(db, a, body.participants)
  notifyParents(db, a, added)
  return db.activityParticipants.filter((p) => p.activityId === a.id) // mảng ActivityParticipant theo openapi.yaml
})

// Ảnh: kiểm tra loại và dung lượng. Mock lưu data URL đã thu nhỏ; backend thật lưu object storage, DB chỉ giữ metadata.
route('POST', '/activities/:id/images', ({ db, actor, params, body }) => {
  need(actor, 'TEACHER')
  const a = found(db.activities.find((x) => x.id === params.id), 'hoạt động')
  classAccess(db, actor, a.classId)
  if (!ALLOWED_MIME.includes(body.mime)) throw new ApiError(400, 'INVALID_FILE', 'Chỉ nhận ảnh JPG, PNG hoặc WEBP.', 'image')
  if (!(body.size > 0) || body.size > MAX_IMAGE_BYTES) throw new ApiError(400, 'FILE_TOO_LARGE', 'Ảnh vượt quá 2 MB.', 'image')
  if (!String(body.dataUrl || '').startsWith(`data:${body.mime};base64,`) || body.dataUrl.length > MAX_DATA_URL) throw new ApiError(400, 'FILE_TOO_LARGE', 'Ảnh sau khi xử lý vẫn quá lớn.', 'image')
  if (db.activityImages.filter((i) => i.activityId === a.id).length >= MAX_IMAGES) throw new ApiError(409, 'TOO_MANY_IMAGES', `Mỗi hoạt động tối đa ${MAX_IMAGES} ảnh.`, 'image')
  const id = uid()
  db.activityImages.push({ id, activityId: a.id, objectKey: `activities/${a.id}/${id}`, url: body.dataUrl, name: String(body.name || 'anh').slice(0, 100) })
  audit(db, actor, 'UPLOAD_IMAGE', 'activity', a.id, { label: a.title })
  const img = db.activityImages.find((i) => i.id === id)
  return { id: img.id, objectKey: img.objectKey, url: img.url, name: img.name } // ActivityImage theo openapi.yaml
})

// Phụ huynh (hoặc giáo viên/quản lý có quyền) xem hoạt động của một bé
route('GET', '/children/:id/activities', ({ db, actor, params, query }) => {
  need(actor, 'PARENT', 'TEACHER', 'MANAGER')
  const child = found(db.children.find((c) => c.id === params.id), 'hồ sơ trẻ')
  childAccess(db, actor, child)
  const ids = new Set(db.activityParticipants.filter((p) => p.childId === child.id && p.participationStatus === 'JOINED').map((p) => p.activityId))
  const rows = db.activities.filter((a) => ids.has(a.id)).sort((x, y) => y.date.localeCompare(x.date) || y.createdAt.localeCompare(x.createdAt))
  const p = paginate(rows, query)
  // Phụ huynh không cần danh sách trẻ khác trong hoạt động
  return { ...p, items: p.items.map((a) => ({ ...out(db, a), participants: undefined, participantCount: db.activityParticipants.filter((x) => x.activityId === a.id).length })) }
})
