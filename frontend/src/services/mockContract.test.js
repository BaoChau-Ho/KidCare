// @vitest-environment jsdom
// Mock server (dùng khi VITE_USE_MOCK khác 'false') phải trả dữ liệu cùng dạng với hợp đồng
// docs/02-design/openapi.yaml, vì giao diện được viết và test trên mock. Nếu mock lệch hợp đồng,
// giao diện chạy đúng với mock nhưng hỏng khi nối backend thật.
// Phạm vi: các API giai đoạn 1–2 mà backend đã làm (tài khoản, audit log, lớp, trẻ).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import { beforeAll, describe, expect, it } from 'vitest'
import { mockRequest } from './mockServer.js'
import { resetMockDb } from './mockDb.js'
import { saveSession } from './auth.js'

globalThis.__MOCK_DELAY__ = 0

// Trong môi trường jsdom, import.meta.url không phải file:// nên tính từ thư mục chạy test (frontend/).
const SPEC = readFileSync(resolve(cwd(), '../docs/02-design/openapi.yaml'), 'utf8').split(/\r?\n/)

/** Đọc `properties` và `required` của một schema trong components/schemas. */
function schema(name) {
  const start = SPEC.findIndex((line) => line === `    ${name}:`)
  if (start < 0) throw new Error(`openapi.yaml không có schema ${name}`)
  const properties = new Set()
  let required = []
  for (const line of SPEC.slice(start + 1)) {
    if (/^ {0,4}\S/.test(line)) break
    const prop = line.match(/^ {8}(\w+):/)
    if (prop) properties.add(prop[1])
    const req = line.match(/^ {6}required: \[(.*)\]/)
    if (req) required = req[1].split(',').map((s) => s.trim())
  }
  return { properties, required }
}

// Trường lồng nhau cần kiểm tra theo schema riêng.
const NESTED = {
  Classroom: { teachers: 'TeacherSummary' },
  Child: { parents: 'ChildParentSummary' },
}

const violations = new Set()

function check(value, name, where) {
  const { properties, required } = schema(name)
  for (const key of required) if (!(key in value)) violations.add(`${where}: thiếu "${key}" (${name})`)
  for (const key of Object.keys(value)) if (!properties.has(key)) violations.add(`${where}: thừa "${key}" (${name})`)
  for (const [key, nested] of Object.entries(NESTED[name] ?? {})) {
    for (const item of value[key] ?? []) check(item, nested, `${where} › ${key}[]`)
  }
}

function checkPage(page, itemSchema, where) {
  check(page, `${itemSchema === 'Classroom' ? 'Class' : itemSchema}Page`, where)
  check(page.pageInfo, 'PageInfo', `${where} › pageInfo`)
  for (const item of page.items) check(item, itemSchema, `${where} › items[]`)
}

const as = (email, role) => saveSession({ user: { email, role }, token: 't' })

// Lệch đã biết (06/11/2026). Sửa mock cho khớp hợp đồng thì xóa dòng tương ứng; MC-03 sẽ nhắc.
const KNOWN = [
  // Audit log của mock dùng tên trường riêng; backend và hợp đồng dùng actorName, oldValue, newValue,
  // resourceName, createdAt. AuditPanel đã đọc được cả hai dạng; còn lệch tên hành động (xem backendShape.test.jsx).
  'GET /audit-logs › items[]: thiếu "createdAt" (AuditLog)',
  'GET /audit-logs › items[]: thừa "actorEmail" (AuditLog)',
  'GET /audit-logs › items[]: thừa "after" (AuditLog)',
  'GET /audit-logs › items[]: thừa "at" (AuditLog)',
  'GET /audit-logs › items[]: thừa "before" (AuditLog)',
  'GET /audit-logs › items[]: thừa "label" (AuditLog)',
  // Phụ huynh của trẻ: mock trả userId, email, phone; hợp đồng là parentUserId, fullName, relationship.
  // Tab "Phụ huynh" đọc p.userId, p.email, p.phone nên sẽ trống khi nối backend.
  'GET /children/{id} › parents[]: thiếu "parentUserId" (ChildParentSummary)',
  'GET /children/{id} › parents[]: thừa "email" (ChildParentSummary)',
  'GET /children/{id} › parents[]: thừa "phone" (ChildParentSummary)',
  'GET /children/{id} › parents[]: thừa "userId" (ChildParentSummary)',
  // Mock chỉ trả parents cho quản lý ở GET /children/{id}; hợp đồng bắt buộc parents ở mọi Child.
  'GET /children › items[]: thiếu "parents" (Child)',
  'POST /children: thiếu "parents" (Child)',
  // Giáo viên của lớp: mock trả userId, hợp đồng là id. Hộp thoại phân công so theo t.userId
  // nên khi nối backend sẽ coi mọi giáo viên đang dạy là "Đã khóa".
  'GET /classes › items[] › teachers[]: thiếu "id" (TeacherSummary)',
  'GET /classes › items[] › teachers[]: thừa "userId" (TeacherSummary)',
  'GET /classes/{id} › teachers[]: thiếu "id" (TeacherSummary)',
  'GET /classes/{id} › teachers[]: thừa "userId" (TeacherSummary)',
  'POST /classes/{id}/teachers › []: thừa "assignedAt" (ClassTeacherAssignment)',
]

beforeAll(async () => {
  resetMockDb()

  as('manager@demo.com', 'manager')
  const classes = await mockRequest('GET', '/classes')
  checkPage(classes, 'Classroom', 'GET /classes')
  const mam = classes.items.find((c) => c.name === 'Lớp Mầm 1')
  const choi = classes.items.find((c) => c.name === 'Lớp Chồi 1')
  check(await mockRequest('GET', `/classes/${mam.id}`), 'Classroom', 'GET /classes/{id}')
  check(await mockRequest('POST', '/classes', { body: { name: 'Lớp Lá 9', academicYear: '2026-2027' } }), 'Classroom', 'POST /classes')

  const teachers = await mockRequest('GET', '/users', { query: { role: 'TEACHER', status: 'ACTIVE' } })
  checkPage(teachers, 'User', 'GET /users?role=TEACHER (quản lý)')
  const ha = teachers.items.find((u) => u.email === 'teacher@demo.com')
  const assigned = await mockRequest('POST', `/classes/${choi.id}/teachers`, { body: { teacherUserIds: [ha.id] } })
  for (const item of assigned) check(item, 'ClassTeacherAssignment', 'POST /classes/{id}/teachers › []')

  const children = await mockRequest('GET', '/children')
  checkPage(children, 'Child', 'GET /children')
  const an = children.items.find((c) => c.name === 'Nguyễn Minh An')
  check(await mockRequest('GET', `/children/${an.id}`), 'Child', 'GET /children/{id}')
  check(
    await mockRequest('POST', '/children', { body: { name: 'Bé Mới', dateOfBirth: '2022-02-02', gender: 'FEMALE', classId: mam.id } }),
    'Child',
    'POST /children',
  )
  const parents = await mockRequest('GET', '/users', { query: { role: 'PARENT', query: 'parent2@demo.com' } })
  const link = await mockRequest('POST', `/children/${an.id}/parents`, { body: { parentUserId: parents.items[0].id, relationship: 'MOTHER' } })
  check(link, 'ChildParentLink', 'POST /children/{id}/parents')

  as('admin@demo.com', 'admin')
  const users = await mockRequest('GET', '/users')
  checkPage(users, 'User', 'GET /users')
  const target = users.items.find((u) => u.email === 'chau.teacher@demo.com')
  check(await mockRequest('PATCH', `/users/${target.id}/role`, { body: { role: 'MANAGER' } }), 'User', 'PATCH /users/{id}/role')
  check(
    await mockRequest('POST', '/users', { body: { fullName: 'Cô Lan', email: 'lan@demo.com', temporaryPassword: 'Abc@12345', role: 'TEACHER' } }),
    'User',
    'POST /users',
  )
  checkPage(await mockRequest('GET', '/audit-logs'), 'AuditLog', 'GET /audit-logs')
})

describe('mock server khớp hợp đồng openapi.yaml (giai đoạn 1–2)', () => {
  it('MC-01 đọc được schema trong openapi.yaml', () => {
    expect(schema('Child').required).toContain('parents')
    expect(schema('TeacherSummary').properties).toEqual(new Set(['id', 'fullName', 'email']))
  })

  it('MC-02 dữ liệu mock trả về đúng các trường của schema: không thiếu trường bắt buộc, không có trường lạ', () => {
    expect([...violations].filter((v) => !KNOWN.includes(v)).sort()).toEqual([])
  })

  it('MC-03 danh sách lệch đã biết không còn mục nào đã được sửa', () => {
    expect(KNOWN.filter((v) => !violations.has(v))).toEqual([])
  })
})
