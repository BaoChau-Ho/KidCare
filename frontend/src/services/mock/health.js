// UC-09 — Hồ sơ sức khỏe. Mọi quyết định "vai trò nào thấy trường nào" nằm ở summaryFor() bên dưới.
import { ApiError } from '../apiError.js'
import {
  route, need, found, bad, uid, now, audit, paginate, diffObj, me, classAccess, childAccess, notify, parentsOf, teachersOfClass,
  todayStr, nowTime, isDate, isTime, addDays, userName,
} from '../mockCore.js'

// Ngưỡng cảnh báo (cần chốt với nhóm theo stage-4)
const FEVER = 37.5
const LOW_TEMP = 35
const RANGES = { height: [30, 150, 'Chiều cao', 'cm'], weight: [2, 50, 'Cân nặng', 'kg'], temperature: [34, 42, 'Nhiệt độ', '°C'] }
const SEVERITIES = ['MILD', 'MODERATE', 'SEVERE']

const loadChild = (db, id) => found(db.children.find((c) => c.id === id), 'hồ sơ trẻ')
const asNumber = (v, key) => {
  if (v === '' || v == null) return null
  const n = Number(v)
  const [min, max, label, unit] = RANGES[key]
  if (Number.isNaN(n) || n < min || n > max) bad(`${label} phải trong khoảng ${min} đến ${max} ${unit}.`, key)
  return n
}
const abnormalOf = (r) => (r.temperature != null && (r.temperature >= FEVER || r.temperature <= LOW_TEMP) ? ['TEMPERATURE'] : [])
const sortDesc = (arr, key) => [...arr].sort((a, b) => String(b[key]).localeCompare(String(a[key])))

// Thông báo chung chung, không chứa chi tiết sức khỏe (stage-4/6)
function notifyHealth(db, child, abnormal) {
  notify(db, parentsOf(db, child.id), {
    type: 'HEALTH', relatedType: 'child', relatedId: child.id,
    title: abnormal ? `Sức khỏe của ${child.name} cần lưu ý` : `Hồ sơ sức khỏe của ${child.name} vừa được cập nhật`,
    content: 'Mở mục Sức khỏe để xem chi tiết.',
  })
  if (abnormal) notify(db, teachersOfClass(db, child.classId), { type: 'HEALTH', relatedType: 'child', relatedId: child.id, title: `Lưu ý sức khỏe của ${child.name}`, content: 'Hãy theo dõi bé và liên hệ nhân viên y tế.' })
}

/* ---------- lọc theo vai trò: một chỗ duy nhất ---------- */
function summaryFor(db, actor, child) {
  const allergies = db.allergies.filter((a) => a.childId === child.id && a.active)
  const conditions = db.medicalConditions.filter((a) => a.childId === child.id && a.active)
  const records = sortDesc(db.healthRecords.filter((r) => r.childId === child.id), 'recordedAt')
  const vaccinations = sortDesc(db.vaccinations.filter((v) => v.childId === child.id), 'vaccinatedAt')
  const visits = sortDesc(db.medicalVisits.filter((v) => v.childId === child.id), 'visitedAt')
  const soon = addDays(todayStr(), 30)
  const upcoming = vaccinations.filter((v) => v.nextDueDate && v.nextDueDate <= soon)
  const base = { childId: child.id, childName: child.name }

  if (actor.role === 'TEACHER') {
    // Giáo viên chỉ thấy cảnh báo cần thiết cho an toàn: tên và mức độ, không có ghi chú/chẩn đoán/số đo
    return {
      ...base, view: 'ALERT_ONLY', latestRecord: null, vaccinations: [], upcomingVaccinations: [], visits: [],
      allergies: allergies.map(({ id, allergen, severity }) => ({ id, allergen, severity })),
      medicalConditions: conditions.map(({ id, name }) => ({ id, name })),
    }
  }
  if (actor.role === 'PARENT') {
    const r = records[0]
    return {
      ...base, view: 'PARENT',
      latestRecord: r ? { id: r.id, childId: child.id, height: r.height, weight: r.weight, temperature: r.temperature, recordedAt: r.recordedAt } : null,
      allergies: allergies.map(({ id, allergen, severity }) => ({ id, allergen, severity })),
      medicalConditions: conditions.map(({ id, name }) => ({ id, name })),
      vaccinations: vaccinations.map(({ id, vaccineName, doseNumber, vaccinatedAt, nextDueDate }) => ({ id, childId: child.id, vaccineName, doseNumber, vaccinatedAt, nextDueDate })),
      upcomingVaccinations: upcoming.map(({ id, vaccineName, doseNumber, vaccinatedAt, nextDueDate }) => ({ id, childId: child.id, vaccineName, doseNumber, vaccinatedAt, nextDueDate })),
      // Phụ huynh thấy ngày khám, triệu chứng và thuốc; không thấy kết luận/chẩn đoán chi tiết
      visits: visits.slice(0, 10).map(({ id, visitedAt, symptoms, medications }) => ({ id, childId: child.id, visitedAt, symptoms, medications })),
    }
  }
  const r = records[0]
  return { ...base, view: 'FULL', latestRecord: r ?? null, allergies, medicalConditions: conditions, vaccinations, upcomingVaccinations: upcoming, visits: visits.slice(0, 10), abnormal: r ? abnormalOf(r) : [] }
}

route('GET', '/children/:id/health-summary', ({ db, actor, params }) => {
  need(actor, 'MEDICAL_STAFF', 'PARENT', 'TEACHER')
  const child = loadChild(db, params.id)
  childAccess(db, actor, child, ['MEDICAL_STAFF', 'PARENT', 'TEACHER'])
  return summaryFor(db, actor, child)
})

route('GET', '/classes/:id/health-alerts', ({ db, actor, params }) => {
  need(actor, 'TEACHER', 'MEDICAL_STAFF', 'MANAGER')
  const c = found(db.classes.find((x) => x.id === params.id), 'lớp')
  if (actor.role !== 'MEDICAL_STAFF') classAccess(db, actor, c.id)
  const items = []
  for (const ch of db.children.filter((x) => x.classId === c.id && x.status === 'ACTIVE')) {
    for (const a of db.allergies.filter((x) => x.childId === ch.id && x.active)) items.push({ childId: ch.id, childName: ch.name, kind: 'ALLERGY', allergen: a.allergen, severity: a.severity })
    for (const m of db.medicalConditions.filter((x) => x.childId === ch.id && x.active)) items.push({ childId: ch.id, childName: ch.name, kind: 'CONDITION', allergen: m.name, severity: null })
  }
  return items // mảng HealthAlert theo openapi.yaml
})

/* ---------- số đo ---------- */
route('GET', '/children/:id/health-records', ({ db, actor, params, query }) => {
  need(actor, 'MEDICAL_STAFF')
  const child = loadChild(db, params.id)
  const rows = sortDesc(db.healthRecords.filter((r) => r.childId === child.id), 'recordedAt')
  const p = paginate(rows, query)
  return { ...p, items: p.items.map((r) => ({ ...r, recordedByName: userName(db, r.recordedByUserId), abnormal: abnormalOf(r) })) }
})

const recordFields = (body) => {
  const out = { height: asNumber(body.height, 'height'), weight: asNumber(body.weight, 'weight'), temperature: asNumber(body.temperature, 'temperature'), note: (body.note || '').trim() || null }
  if (out.height == null && out.weight == null && out.temperature == null) bad('Nhập ít nhất một chỉ số (chiều cao, cân nặng hoặc nhiệt độ).', 'height')
  if (out.note && out.note.length > 2000) bad('Ghi chú tối đa 2000 ký tự.', 'note')
  return out
}

route('POST', '/children/:id/health-records', ({ db, actor, params, body }) => {
  need(actor, 'MEDICAL_STAFF')
  const child = loadChild(db, params.id)
  const f = recordFields(body)
  const rec = { id: uid(), childId: child.id, ...f, recordedAt: `${todayStr()}T${nowTime()}`, recordedByUserId: me(db, actor).id }
  db.healthRecords.push(rec)
  const abnormal = abnormalOf(rec)
  audit(db, actor, 'CREATE_HEALTH', 'child', child.id, { label: child.name, after: { height: f.height, weight: f.weight, temperature: f.temperature } })
  notifyHealth(db, child, abnormal.length > 0)
  return { ...rec, abnormal }
})

route('PATCH', '/health-records/:id', ({ db, actor, params, body }) => {
  need(actor, 'MEDICAL_STAFF')
  const rec = found(db.healthRecords.find((r) => r.id === params.id), 'bản ghi sức khỏe')
  const child = loadChild(db, rec.childId)
  const f = recordFields({ height: 'height' in body ? body.height : rec.height, weight: 'weight' in body ? body.weight : rec.weight, temperature: 'temperature' in body ? body.temperature : rec.temperature, note: 'note' in body ? body.note : rec.note })
  const { before, after } = diffObj(rec, { height: f.height, weight: f.weight, temperature: f.temperature })
  Object.assign(rec, f)
  // Ghi chú có thể nhạy cảm nên audit chỉ ghi "đã cập nhật", không ghi nội dung
  if ('note' in body) after.note = 'đã cập nhật'
  if (Object.keys(after).length) audit(db, actor, 'UPDATE_HEALTH', 'child', child.id, { label: child.name, before, after })
  return { ...rec, abnormal: abnormalOf(rec) }
})

/* ---------- dị ứng và bệnh nền ---------- */
for (const [path, coll, label] of [['allergies', 'allergies', 'dị ứng'], ['medical-conditions', 'medicalConditions', 'bệnh nền']]) {
  const isAllergy = coll === 'allergies'
  route('GET', `/children/:id/${path}`, ({ db, actor, params }) => {
    need(actor, 'MEDICAL_STAFF')
    const child = loadChild(db, params.id)
    return { items: sortDesc(db[coll].filter((x) => x.childId === child.id), 'createdAt') }
  })
  route('POST', `/children/:id/${path}`, ({ db, actor, params, body }) => {
    need(actor, 'MEDICAL_STAFF')
    const child = loadChild(db, params.id)
    const name = (body[isAllergy ? 'allergen' : 'name'] || '').trim()
    if (!name) bad(isAllergy ? 'Nhập tác nhân gây dị ứng.' : 'Nhập tên bệnh nền.', isAllergy ? 'allergen' : 'name')
    if (isAllergy && !SEVERITIES.includes(body.severity)) bad('Chọn mức độ.', 'severity')
    if (db[coll].some((x) => x.childId === child.id && x.active && (x.allergen ?? x.name).toLowerCase() === name.toLowerCase())) {
      throw new ApiError(409, 'DUPLICATE', `Trẻ đã có ${label} này trong hồ sơ.`, isAllergy ? 'allergen' : 'name')
    }
    const item = { id: uid(), childId: child.id, [isAllergy ? 'allergen' : 'name']: name, ...(isAllergy && { severity: body.severity }), note: (body.note || '').trim() || null, active: true, createdAt: now() }
    db[coll].push(item)
    audit(db, actor, 'CREATE_HEALTH', 'child', child.id, { label: child.name, after: { [isAllergy ? 'allergen' : 'name']: name } })
    notifyHealth(db, child, false)
    return item
  })
  route('PATCH', `/${path}/:id`, ({ db, actor, params, body }) => {
    need(actor, 'MEDICAL_STAFF')
    const item = found(db[coll].find((x) => x.id === params.id), label)
    const child = loadChild(db, item.childId)
    const before = { active: item.active }
    if ('active' in body) item.active = !!body.active
    if (isAllergy && 'severity' in body) { if (!SEVERITIES.includes(body.severity)) bad('Chọn mức độ.', 'severity'); before.severity = item.severity; item.severity = body.severity }
    if ('note' in body) item.note = (body.note || '').trim() || null
    const after = { active: item.active, ...(isAllergy && { severity: item.severity }) }
    const d = diffObj({ ...before, severity: before.severity ?? item.severity }, after)
    if (Object.keys(d.after).length) audit(db, actor, 'UPDATE_HEALTH', 'child', child.id, { label: child.name, ...d })
    return item
  })
}

/* ---------- tiêm chủng ---------- */
route('GET', '/children/:id/vaccinations', ({ db, actor, params, query }) => {
  need(actor, 'MEDICAL_STAFF')
  const child = loadChild(db, params.id)
  return paginate(sortDesc(db.vaccinations.filter((v) => v.childId === child.id), 'vaccinatedAt'), query)
})
route('POST', '/children/:id/vaccinations', ({ db, actor, params, body }) => {
  need(actor, 'MEDICAL_STAFF')
  const child = loadChild(db, params.id)
  const vaccineName = (body.vaccineName || '').trim()
  const dose = Number(body.doseNumber)
  if (!vaccineName) bad('Nhập tên vắc-xin.', 'vaccineName')
  if (!Number.isInteger(dose) || dose < 1 || dose > 10) bad('Mũi số phải là số nguyên từ 1 đến 10.', 'doseNumber')
  if (!isDate(body.vaccinatedAt) || body.vaccinatedAt > todayStr()) bad('Ngày tiêm không hợp lệ hoặc ở tương lai.', 'vaccinatedAt')
  if (body.nextDueDate && (!isDate(body.nextDueDate) || body.nextDueDate <= body.vaccinatedAt)) bad('Ngày hẹn mũi tiếp theo phải sau ngày tiêm.', 'nextDueDate')
  if (db.vaccinations.some((v) => v.childId === child.id && v.vaccineName.toLowerCase() === vaccineName.toLowerCase() && v.doseNumber === dose)) {
    throw new ApiError(409, 'DUPLICATE', 'Mũi tiêm này đã được ghi nhận.', 'doseNumber')
  }
  const v = { id: uid(), childId: child.id, vaccineName, doseNumber: dose, vaccinatedAt: body.vaccinatedAt, nextDueDate: body.nextDueDate || null, recordedByUserId: me(db, actor).id }
  db.vaccinations.push(v)
  audit(db, actor, 'CREATE_HEALTH', 'child', child.id, { label: child.name, after: { vaccine: `${vaccineName} (mũi ${dose})` } })
  notifyHealth(db, child, false)
  return v
})

/* ---------- lần khám và thuốc ---------- */
route('GET', '/children/:id/medical-visits', ({ db, actor, params, query }) => {
  need(actor, 'MEDICAL_STAFF')
  const child = loadChild(db, params.id)
  const p = paginate(sortDesc(db.medicalVisits.filter((v) => v.childId === child.id), 'visitedAt'), query)
  return { ...p, items: p.items.map((v) => ({ ...v, examinerName: userName(db, v.examinerUserId) })) }
})
route('POST', '/children/:id/medical-visits', ({ db, actor, params, body }) => {
  need(actor, 'MEDICAL_STAFF')
  const child = loadChild(db, params.id)
  const date = (body.visitedAt || '').slice(0, 10) || todayStr()
  const time = (body.visitedAt || '').slice(11, 16) || nowTime()
  if (!isDate(date) || !isTime(time)) bad('Thời điểm khám không hợp lệ.', 'visitedAt')
  if (`${date}T${time}` > `${todayStr()}T${nowTime()}`) bad('Thời điểm khám không được ở tương lai.', 'visitedAt')
  const symptoms = (body.symptoms || '').trim(), conclusion = (body.conclusion || '').trim()
  if (!symptoms && !conclusion) bad('Nhập triệu chứng hoặc kết luận.', 'symptoms')
  const meds = (body.medications || []).map((m) => ({ name: (m.name || '').trim(), dosage: (m.dosage || '').trim(), schedule: (m.schedule || '').trim() })).filter((m) => m.name || m.dosage || m.schedule)
  if (meds.some((m) => !m.name || !m.dosage || !m.schedule)) bad('Mỗi loại thuốc cần đủ tên, liều dùng và lịch dùng.', 'medications')
  const v = { id: uid(), childId: child.id, visitedAt: `${date}T${time}`, symptoms: symptoms || null, conclusion: conclusion || null, medications: meds, examinerUserId: me(db, actor).id }
  db.medicalVisits.push(v)
  audit(db, actor, 'CREATE_HEALTH', 'child', child.id, { label: child.name, after: { visit: date } })
  notifyHealth(db, child, false)
  return v
})
