// Kho dữ liệu mock dùng chung cho auth.js (đăng nhập) và mockServer.js (trang quản lý).
// Lưu trong localStorage. Khi có backend thật, bỏ file này.
const KEY = 'kidcare.mockdb.v4'
import { todayStr, addDays, isWeekend } from './dates.js'
const uid = () => crypto.randomUUID()

/* ---------- dữ liệu mẫu ---------- */
function seedCore() {
  const t = '2026-09-01T00:00:00.000Z'
  const u = (fullName, email, phone, role, status = 'ACTIVE') => ({ id: uid(), fullName, email, phone, role, status, createdAt: t })
  const users = [
    u('Quản trị viên', 'admin@demo.com', '0900000001', 'ADMIN'),
    u('Trần Thị Quản Lý', 'manager@demo.com', '0900000002', 'MANAGER'),
    u('Nguyễn Thu Hà', 'teacher@demo.com', '0900000003', 'TEACHER'),
    u('Lê Minh Châu', 'chau.teacher@demo.com', '0900000004', 'TEACHER'),
    u('Phạm Quốc Việt', 'disabled@demo.com', '0900000005', 'TEACHER', 'LOCKED'),
    u('Võ Thanh Y Tế', 'medical@demo.com', '0900000006', 'MEDICAL_STAFF'),
    u('Nguyễn Văn Phụ', 'parent@demo.com', '0900000007', 'PARENT'),
    u('Đỗ Thị Mai', 'parent2@demo.com', '0900000008', 'PARENT'),
  ]
  const [, , ha, chau, , , p1, p2] = users
  const cls = (name, academicYear, status = 'ACTIVE') => ({ id: uid(), name, academicYear, status })
  const classes = [cls('Lớp Mầm 1', '2026-2027'), cls('Lớp Chồi 1', '2026-2027'), cls('Lớp Lá 3', '2025-2026', 'CLOSED')]
  const ch = (name, dateOfBirth, gender, address, c, status = 'ACTIVE') => ({ id: uid(), name, dateOfBirth, gender, address, avatarUrl: null, classId: c.id, status })
  const children = [
    ch('Nguyễn Minh An', '2022-03-14', 'MALE', '12 Láng Hạ, Hà Nội', classes[0]),
    ch('Nguyễn Bảo Châu', '2021-07-02', 'FEMALE', '12 Láng Hạ, Hà Nội', classes[1]),
    ch('Đỗ Gia Huy', '2022-01-20', 'MALE', '45 Kim Mã, Hà Nội', classes[0]),
    ch('Đỗ Khánh Linh', '2021-11-09', 'FEMALE', '45 Kim Mã, Hà Nội', classes[1]),
    ch('Trần Tuấn Kiệt', '2020-05-30', 'MALE', '8 Cầu Giấy, Hà Nội', classes[2], 'WITHDRAWN'),
  ]
  return {
    users, classes, children, auditLogs: [],
    // CHỈ DÙNG CHO MOCK: mật khẩu tạm lưu riêng khỏi hồ sơ user, không bao giờ trả ra API
    credentials: Object.fromEntries(users.map((x) => [x.email, 'Password@123'])),
    classTeachers: [
      { classId: classes[0].id, teacherUserId: ha.id, assignedAt: t },
      { classId: classes[0].id, teacherUserId: chau.id, assignedAt: t },
      { classId: classes[1].id, teacherUserId: chau.id, assignedAt: t },
    ],
    childParents: [
      { childId: children[0].id, parentUserId: p1.id, relationship: 'FATHER' },
      { childId: children[1].id, parentUserId: p1.id, relationship: 'FATHER' },
      { childId: children[2].id, parentUserId: p2.id, relationship: 'MOTHER' },
      { childId: children[3].id, parentUserId: p2.id, relationship: 'MOTHER' },
    ],
  }
}

let cache = null
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(cache)) } catch { /* bỏ qua */ } }

// Dữ liệu mẫu cho UC-06..15 (điểm danh, nghỉ học, sức khỏe, hoạt động, đón trẻ, thông báo)
function seedMore({ users, classes, children }) {
  const [, , ha, chau, , medical, p1, p2] = users
  const [an, chauChild, huy, linh] = children
  const today = todayStr()
  const at = (d, hm) => `${d}T${hm}`

  // Điểm danh 14 ngày gần nhất (bỏ cuối tuần) cho 4 bé đang học
  const attendance = []
  const cls = { [an.id]: ha, [chauChild.id]: chau, [huy.id]: ha, [linh.id]: chau }
  for (let i = 14; i >= 1; i -= 1) {
    const d = addDays(today, -i)
    if (isWeekend(d)) continue
    ;[an, chauChild, huy, linh].forEach((c, j) => {
      const absent = (i + j) % 7 === 3
      const late = !absent && (i * 3 + j) % 5 === 1
      const early = !absent && (i + j) % 6 === 0
      attendance.push({
        id: uid(), childId: c.id, date: d, status: absent ? 'ABSENT' : late ? 'LATE' : 'PRESENT',
        checkInTime: absent ? null : at(d, late ? '08:20' : '07:50'), checkOutTime: absent ? null : at(d, early ? '15:00' : '16:30'),
        recordedByUserId: cls[c.id].id, createdAt: `${d}T08:00:00.000Z`, updatedAt: `${d}T08:00:00.000Z`,
      })
    })
  }
  // Bản ghi hôm nay chỉ tạo khi giờ hiện tại đã qua giờ đó (không để giờ đến nằm ở tương lai)
  const d0 = new Date()
  const hm = `${String(d0.getHours()).padStart(2, '0')}:${String(d0.getMinutes()).padStart(2, '0')}`
  const stamp = d0.toISOString()
  if (hm > '07:55') attendance.push({ id: uid(), childId: an.id, date: today, status: 'PRESENT', checkInTime: at(today, '07:55'), checkOutTime: null, recordedByUserId: ha.id, createdAt: stamp, updatedAt: stamp })
  if (hm > '08:20') attendance.push({ id: uid(), childId: huy.id, date: today, status: 'LATE', checkInTime: at(today, '08:20'), checkOutTime: null, recordedByUserId: ha.id, createdAt: stamp, updatedAt: stamp })

  const leaveRequests = [
    { id: uid(), childId: huy.id, parentUserId: p2.id, fromDate: addDays(today, 1), toDate: addDays(today, 2), reason: 'Gia đình có việc, xin cho bé nghỉ hai ngày.', status: 'PENDING', decidedByUserId: null, decidedAt: null, decisionReason: null, createdAt: new Date().toISOString() },
    { id: uid(), childId: linh.id, parentUserId: p2.id, fromDate: today, toDate: addDays(today, 1), reason: 'Bé đi khám định kỳ.', status: 'APPROVED', decidedByUserId: chau.id, decidedAt: new Date().toISOString(), decisionReason: null, createdAt: addDays(today, -2) + 'T09:00:00.000Z' },
    { id: uid(), childId: an.id, parentUserId: p1.id, fromDate: addDays(today, -20), toDate: addDays(today, -19), reason: 'Về quê.', status: 'REJECTED', decidedByUserId: ha.id, decidedAt: addDays(today, -21) + 'T10:00:00.000Z', decisionReason: 'Đơn gửi sau ngày nghỉ.', createdAt: addDays(today, -22) + 'T09:00:00.000Z' },
  ]

  // Số đo 3 mốc cho mỗi bé; Huy sốt nhẹ hôm qua để thấy cảnh báo
  const healthRecords = []
  const base = [[an, 98.5, 15.2], [chauChild, 104, 17.1], [huy, 97, 14.8], [linh, 101, 16.0]]
  for (const [c, h, w] of base) {
    ;[[-90, 0], [-60, 0.9], [-30, 1.8]].forEach(([off, k]) => {
      healthRecords.push({ id: uid(), childId: c.id, height: Math.round((h + k) * 10) / 10, weight: Math.round((w + k / 3) * 10) / 10, temperature: 36.6, note: null, recordedAt: at(addDays(today, off), '09:00'), recordedByUserId: medical.id })
    })
  }
  healthRecords.push({ id: uid(), childId: huy.id, height: null, weight: null, temperature: 37.8, note: 'Sốt nhẹ buổi sáng, đã báo phụ huynh.', recordedAt: at(addDays(today, -1), '10:15'), recordedByUserId: medical.id })

  const allergies = [
    { id: uid(), childId: an.id, allergen: 'Đậu phộng', severity: 'SEVERE', note: 'Tránh mọi món có đậu phộng; có thuốc dự phòng tại phòng y tế.', active: true, createdAt: '2026-09-01T00:00:00.000Z' },
    { id: uid(), childId: linh.id, allergen: 'Hải sản', severity: 'MODERATE', note: null, active: true, createdAt: '2026-09-01T00:00:00.000Z' },
  ]
  const medicalConditions = [{ id: uid(), childId: huy.id, name: 'Hen suyễn nhẹ', note: 'Theo dõi khi vận động mạnh.', active: true, createdAt: '2026-09-01T00:00:00.000Z' }]
  const vaccinations = [
    { id: uid(), childId: an.id, vaccineName: 'Sởi - Quai bị - Rubella', doseNumber: 1, vaccinatedAt: addDays(today, -200), nextDueDate: addDays(today, 20), recordedByUserId: medical.id },
    { id: uid(), childId: an.id, vaccineName: 'Viêm gan B', doseNumber: 3, vaccinatedAt: addDays(today, -300), nextDueDate: null, recordedByUserId: medical.id },
    { id: uid(), childId: chauChild.id, vaccineName: 'Viêm gan B', doseNumber: 3, vaccinatedAt: addDays(today, -400), nextDueDate: null, recordedByUserId: medical.id },
    { id: uid(), childId: huy.id, vaccineName: 'Bại liệt (OPV)', doseNumber: 2, vaccinatedAt: addDays(today, -120), nextDueDate: addDays(today, 15), recordedByUserId: medical.id },
  ]
  const medicalVisits = [
    { id: uid(), childId: an.id, visitedAt: at(addDays(today, -45), '10:00'), symptoms: 'Ho, sốt nhẹ', conclusion: 'Viêm họng cấp', medications: [{ name: 'Paracetamol', dosage: '120 mg', schedule: 'Khi sốt trên 38,5 °C' }], examinerUserId: medical.id },
    { id: uid(), childId: huy.id, visitedAt: at(addDays(today, -10), '14:30'), symptoms: 'Khó thở nhẹ sau giờ thể dục', conclusion: 'Cơn hen nhẹ, theo dõi thêm', medications: [], examinerUserId: medical.id },
  ]

  const activities = [
    { id: uid(), classId: classes[0].id, createdByTeacherUserId: ha.id, title: 'Vẽ tranh mùa thu', description: 'Các bé vẽ lá vàng bằng màu sáp và ghép thành bức tranh chung của lớp.', date: addDays(today, -2), createdAt: addDays(today, -2) + 'T10:00:00.000Z' },
    { id: uid(), classId: classes[0].id, createdByTeacherUserId: ha.id, title: 'Đọc sách cùng cô', description: null, date: addDays(today, -1), createdAt: addDays(today, -1) + 'T09:30:00.000Z' },
    { id: uid(), classId: classes[1].id, createdByTeacherUserId: chau.id, title: 'Tập thể dục buổi sáng', description: 'Bài vận động nhẹ theo nhạc.', date: addDays(today, -1), createdAt: addDays(today, -1) + 'T08:30:00.000Z' },
  ]
  const part = (a, kids) => kids.map((c) => ({ activityId: a.id, childId: c.id, participationStatus: 'JOINED' }))
  const activityParticipants = [...part(activities[0], [an, huy]), ...part(activities[1], [an, huy]), ...part(activities[2], [chauChild, linh])]

  const n = (to, type, title, content, readAt = null, off = 0) => ({ id: uid(), recipientUserId: to.id, senderUserId: null, type, title, content, relatedType: null, relatedId: null, channel: 'IN_APP', createdAt: new Date(Date.now() - off * 60000).toISOString(), readAt })
  const notifications = [
    n(p1, 'ATTENDANCE', `${an.name} đã đến lớp`, 'Giờ đến 07:55.', null, 5),
    n(p1, 'ACTIVITY', `${an.name} tham gia hoạt động "Đọc sách cùng cô"`, 'Mở mục Hoạt động để xem chi tiết.', new Date().toISOString(), 1500),
    n(p2, 'LEAVE', `Đơn xin nghỉ của ${linh.name} đã được duyệt`, 'Nghỉ từ hôm nay.', null, 60),
    n(ha, 'LEAVE', `Đơn xin nghỉ của ${huy.name}`, 'Chờ bạn duyệt.', null, 30),
    n(chau, 'LEAVE', `Đơn xin nghỉ của ${huy.name}`, 'Chờ bạn duyệt.', null, 30),
  ]

  const pickupRequests = [{
    id: uid(), childId: an.id, requesterUserId: p1.id, pickupPerson: 'Nguyễn Văn Bảo', relationship: 'Ông', idNumber: '012345678901', phone: '0912345678',
    expectedTime: at(today, '16:30'), status: 'PENDING', verifiedByTeacherUserId: null, decisionReason: null, decidedAt: null, completedAt: null, createdAt: new Date().toISOString(),
  }]

  return {
    settings: { startTime: '08:00', endTime: '16:00' },
    attendance, leaveRequests, healthRecords, allergies, medicalConditions, vaccinations, medicalVisits,
    activities, activityParticipants, activityImages: [], notifications, pickupRequests,
  }
}
function seed() { const core = seedCore(); return { ...core, ...seedMore(core) } }

export function loadDb() {
  if (cache) return cache
  try { cache = JSON.parse(localStorage.getItem(KEY)) } catch { cache = null }
  if (!cache) { cache = seed(); persist() }
  return cache
}
export function saveDb(db) { cache = db; persist() }
// Nạp lại dữ liệu mẫu: (await import('/src/services/mockDb.js')).resetMockDb()
export function resetMockDb() { cache = null; try { localStorage.removeItem(KEY) } catch { /* bỏ qua */ } }
