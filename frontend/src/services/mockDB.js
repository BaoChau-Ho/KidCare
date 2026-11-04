// Kho dữ liệu mock dùng chung cho auth.js (đăng nhập) và mockServer.js (trang quản lý).
// Lưu trong localStorage. Khi có backend thật, bỏ file này.
const KEY = 'kidcare.mockdb.v3'
const uid = () => crypto.randomUUID()

/* ---------- dữ liệu mẫu ---------- */
function seed() {
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

export function loadDb() {
  if (cache) return cache
  try { cache = JSON.parse(localStorage.getItem(KEY)) } catch { cache = null }
  if (!cache) { cache = seed(); persist() }
  return cache
}
export function saveDb(db) { cache = db; persist() }
// Nạp lại dữ liệu mẫu: (await import('/src/services/mockDb.js')).resetMockDb()
export function resetMockDb() { cache = null; try { localStorage.removeItem(KEY) } catch { /* bỏ qua */ } }