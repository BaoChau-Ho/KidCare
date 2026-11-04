// UC-15 — Báo cáo cho quản lý: chỉ số liệu tổng hợp, không lộ dữ liệu sức khỏe cá nhân
import { ApiError } from '../apiError.js'
import { route, need, bad, todayStr, isDate, addDays, daysBetween, isEarly } from '../mockCore.js'

const rate = (num, den) => (den ? Math.round((num / den) * 1000) / 1000 : null) // phân số 0..1

function range(query) {
  const to = query.to || todayStr()
  const from = query.from || addDays(to, -29)
  if (!isDate(from)) bad('Ngày bắt đầu không hợp lệ.', 'from')
  if (!isDate(to)) bad('Ngày kết thúc không hợp lệ.', 'to')
  if (from > to) bad('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.', 'from')
  if (daysBetween(from, to) > 365) bad('Khoảng thời gian tối đa là 366 ngày.', 'to')
  return { from, to }
}
function classFilter(db, query) {
  if (!query.classId) return db.classes
  const c = db.classes.find((x) => x.id === query.classId)
  if (!c) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy lớp.')
  return [c]
}
const childIdsOf = (db, classes) => new Set(db.children.filter((c) => classes.some((k) => k.id === c.classId)).map((c) => c.id))
const tally = (db, recs) => {
  const t = { present: 0, late: 0, absent: 0, earlyLeave: 0 }
  for (const r of recs) {
    if (r.status === 'ABSENT') t.absent += 1
    else { if (r.status === 'LATE') t.late += 1; else t.present += 1; if (isEarly(db, r)) t.earlyLeave += 1 }
  }
  t.total = t.present + t.late + t.absent
  t.attendanceRate = rate(t.present + t.late, t.total) // tỷ lệ chuyên cần = (có mặt + muộn) / tổng bản ghi
  return t
}

route('GET', '/reports/attendance', ({ db, actor, query }) => {
  need(actor, 'MANAGER')
  const { from, to } = range(query)
  const classes = classFilter(db, query)
  const ids = childIdsOf(db, classes)
  const recs = db.attendance.filter((a) => ids.has(a.childId) && a.date >= from && a.date <= to)
  const byClass = classes.map((c) => {
    const kids = new Set(db.children.filter((ch) => ch.classId === c.id).map((ch) => ch.id))
    return { classId: c.id, className: c.name, academicYear: c.academicYear, ...tally(db, recs.filter((r) => kids.has(r.childId))) }
  })
  const days = [...new Set(recs.map((r) => r.date))].sort()
  const byDay = days.map((d) => ({ date: d, ...tally(db, recs.filter((r) => r.date === d)) }))
  return { from, to, summary: tally(db, recs), byClass, byDay }
})

route('GET', '/reports/classes', ({ db, actor, query }) => {
  need(actor, 'MANAGER')
  const { from, to } = range(query)
  const items = db.classes.filter((c) => c.status === 'ACTIVE').map((c) => {
    const kids = db.children.filter((ch) => ch.classId === c.id)
    const ids = new Set(kids.map((k) => k.id))
    return {
      classId: c.id, className: c.name, academicYear: c.academicYear,
      childCount: kids.filter((k) => k.status === 'ACTIVE').length,
      teacherCount: db.classTeachers.filter((x) => x.classId === c.id).length,
      activityCount: db.activities.filter((a) => a.classId === c.id && a.date >= from && a.date <= to).length,
      leaveCount: db.leaveRequests.filter((l) => ids.has(l.childId) && l.status === 'APPROVED' && l.fromDate <= to && from <= l.toDate).length,
      attendanceRate: tally(db, db.attendance.filter((a) => ids.has(a.childId) && a.date >= from && a.date <= to)).attendanceRate,
    }
  })
  return { from, to, items }
})

// Chỉ đếm tổng hợp: không có tên trẻ, không có chẩn đoán
route('GET', '/reports/health', ({ db, actor, query }) => {
  need(actor, 'MANAGER')
  const { from, to } = range(query)
  const classes = classFilter(db, query)
  const ids = childIdsOf(db, classes)
  const active = db.children.filter((c) => ids.has(c.id) && c.status === 'ACTIVE')
  const inRange = (d) => d && d.slice(0, 10) >= from && d.slice(0, 10) <= to
  const has = (coll, id) => db[coll].some((x) => x.childId === id && x.active)
  const soon = addDays(todayStr(), 30)
  return {
    from, to, childCount: active.length,
    childrenWithAllergy: active.filter((c) => has('allergies', c.id)).length,
    childrenWithCondition: active.filter((c) => has('medicalConditions', c.id)).length,
    measurements: db.healthRecords.filter((r) => ids.has(r.childId) && inRange(r.recordedAt)).length,
    feverCases: db.healthRecords.filter((r) => ids.has(r.childId) && inRange(r.recordedAt) && r.temperature != null && r.temperature >= 37.5).length,
    vaccinationsGiven: db.vaccinations.filter((v) => ids.has(v.childId) && inRange(v.vaccinatedAt)).length,
    vaccinationsDueSoon: db.vaccinations.filter((v) => ids.has(v.childId) && v.nextDueDate && v.nextDueDate >= todayStr() && v.nextDueDate <= soon).length,
    medicalVisits: db.medicalVisits.filter((v) => ids.has(v.childId) && inRange(v.visitedAt)).length,
  }
})
