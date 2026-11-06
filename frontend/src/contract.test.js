// Kiểm tra khớp nối giữa 3 nơi mô tả API:
//   - frontend/src/services/*.js   (frontend gọi gì)
//   - backend/src/**/*.controller.ts (backend có gì)
//   - docs/02-design/openapi.yaml  (hợp đồng nhóm đã thống nhất)
// Đọc mã nguồn bằng regex, không cần chạy backend. Chạy trong CI cùng `npm test`.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { ACTION_LABELS } from './services/labels.js'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SERVICES_DIR = join(ROOT, 'frontend/src/services')
const BACKEND_DIR = join(ROOT, 'backend/src')
const OPENAPI_FILE = join(ROOT, 'docs/02-design/openapi.yaml')

// Module của giai đoạn 3–6 (roadmap): frontend đang chạy bằng mock server, backend chưa làm.
// Khi backend có ít nhất một route chứa từ khóa này, module được coi là đã làm và mọi lời gọi
// tới nó phải có trong backend (quy tắc B).
const PLANNED_MODULES = [
  'attendance',
  'leave-requests',
  'health-records',
  'health-summary',
  'health-alerts',
  'vaccinations',
  'medical-visits',
  'allergies',
  'medical-conditions',
  'activities',
  'pickup-requests',
  'notifications',
  'reports',
]

// Lệch đã biết (06/11/2026). Sửa xong thì xóa dòng tương ứng;
// test CT-05 sẽ báo nếu một dòng ở đây không còn lệch nữa.
const KNOWN_MISMATCHES = {
  frontendNotInSpec: [
    // Đặc tả chỉ có allergies / medicalConditions là trường trong health-summary, không có API riêng.
    'GET /children/{}/allergies',
    'POST /children/{}/allergies',
    'PATCH /allergies/{}',
    'GET /children/{}/medical-conditions',
    'POST /children/{}/medical-conditions',
    'PATCH /medical-conditions/{}',
    // Phụ huynh hủy đơn nghỉ và đánh dấu đọc tất cả thông báo: có trên giao diện, chưa có trong đặc tả.
    'PATCH /leave-requests/{}/cancel',
    'POST /notifications/read-all',
    // Trang giáo viên (hoạt động, gửi thông báo) lấy trẻ trong lớp bằng API này; backend dùng
    // GET /children?classId=... nên sẽ 404 khi tắt mock.
    'GET /classes/{}/children',
  ],
  frontendNotInBackend: ['GET /classes/{}/children'],
  backendNotInSpec: [
    // Đặc tả ghi sai thành PATCH /auth/{id}/approve; phần từ chối trong đặc tả đã dùng /admin/registration-requests.
    'PATCH /admin/registration-requests/{}/approve',
    // Kiểm tra link đặt mật khẩu: backend có, đặc tả chưa có.
    'GET /auth/set-password/check',
  ],
  // ACTION_LABELS chỉ có tên hành động của mock (CHANGE_ROLE, CHANGE_STATUS); nhật ký sẽ hiện mã tiếng Anh.
  auditActionWithoutLabel: ['CHANGE_USER_ROLE', 'CHANGE_USER_STATUS', 'WITHDRAW_CHILD'],
}

/** Đưa mọi tham số đường dẫn (`${id}`, `{childId}`, `:childId`) về `{}` để so sánh. */
const normalize = (method, path) =>
  `${method.toUpperCase()} ${path
    .replace(/\$\{[^}]+\}/g, '{}')
    .replace(/\{[^}]*\}/g, '{}')
    .replace(/:\w+/g, '{}')
    .replace(/\/+/g, '/')
    .replace(/(.)\/$/, '$1')}`

function walk(dir, filter) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return walk(full, filter)
    return filter(entry.name) ? [full] : []
  })
}

function frontendCalls() {
  const files = walk(SERVICES_DIR, (name) => name.endsWith('.js') && !name.startsWith('mock') && !name.includes('.test.'))
  const calls = new Set()
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/\bapi\(\s*'(GET|POST|PUT|PATCH|DELETE)'\s*,\s*(['`])(.*?)\2/g)) {
      calls.add(normalize(m[1], m[3]))
    }
    // Lời gọi fetch trực tiếp, ví dụ đăng nhập trong auth.js: fetch(`${baseUrl}/auth/login`, { method: 'POST' ...
    for (const m of src.matchAll(/fetch\(\s*`\$\{\w+\}(\/[^`?$]*)`\s*,\s*\{\s*method:\s*'(\w+)'/g)) {
      calls.add(normalize(m[2], m[1]))
    }
  }
  return calls
}

function backendRoutes() {
  const routes = new Set()
  for (const file of walk(BACKEND_DIR, (name) => name.endsWith('.controller.ts'))) {
    const src = readFileSync(file, 'utf8')
    const prefix = src.match(/@Controller\(\s*(?:['"]([^'"]*)['"])?\s*\)/)?.[1] ?? ''
    for (const m of src.matchAll(/@(Get|Post|Put|Patch|Delete)\(\s*(?:['"]([^'"]*)['"])?\s*\)/g)) {
      routes.add(normalize(m[1], `/${prefix}/${m[2] ?? ''}`))
    }
  }
  return routes
}

function specOperations() {
  const lines = readFileSync(OPENAPI_FILE, 'utf8').split(/\r?\n/)
  const ops = new Set()
  let inPaths = false
  let current = null
  for (const line of lines) {
    if (/^\S/.test(line)) inPaths = line.startsWith('paths:')
    if (!inPaths) continue
    const path = line.match(/^ {2}(\/\S*):\s*$/)
    if (path) current = path[1]
    const method = line.match(/^ {4}(get|post|put|patch|delete):/)
    if (method && current) ops.add(normalize(method[1], current))
  }
  return ops
}

/** Tên hành động audit log backend ghi, ví dụ action: "CREATE_USER" hoặc ? "CLOSE_CLASS" : "UPDATE_CLASS". */
function backendAuditActions() {
  const actions = new Set()
  for (const file of walk(BACKEND_DIR, (name) => name.endsWith('.service.ts'))) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/action:\s*([^,\n]+),/g)) {
      // Tên hành động luôn có dấu gạch dưới (CLOSE_CLASS); bỏ qua giá trị trạng thái trong điều kiện ("CLOSED").
      for (const name of m[1].matchAll(/["']([A-Z]+_[A-Z_]+)["']/g)) actions.add(name[1])
    }
  }
  return actions
}

const isPlannedAndNotBuilt = (call, backend) =>
  PLANNED_MODULES.some(
    (module) => call.includes(`/${module}`) && ![...backend].some((route) => route.includes(`/${module}`)),
  )

const frontend = frontendCalls()
const backend = backendRoutes()
const spec = specOperations()

const mismatches = {
  frontendNotInSpec: [...frontend].filter((call) => !spec.has(call)).sort(),
  frontendNotInBackend: [...frontend].filter((call) => !backend.has(call) && !isPlannedAndNotBuilt(call, backend)).sort(),
  backendNotInSpec: [...backend].filter((route) => !spec.has(route)).sort(),
  auditActionWithoutLabel: [...backendAuditActions()].filter((action) => !ACTION_LABELS[action]).sort(),
}
const unexpected = (rule) => mismatches[rule].filter((item) => !KNOWN_MISMATCHES[rule].includes(item))

describe('khớp nối frontend, backend và openapi.yaml', () => {
  it('CT-01 đọc được đủ lời gọi API của frontend, route của backend và thao tác trong openapi.yaml', () => {
    // Chặn trường hợp regex hỏng làm danh sách rỗng và mọi test bên dưới "đạt" giả.
    expect(frontend.size).toBeGreaterThanOrEqual(60)
    expect(backend.size).toBeGreaterThanOrEqual(25)
    expect(spec.size).toBeGreaterThanOrEqual(60)
    expect(frontend).toContain('GET /children/{}')
    expect(backend).toContain('PATCH /admin/registration-requests/{}/approve')
    expect(spec).toContain('POST /auth/login')
  })

  it('CT-02 (quy tắc A) mọi API frontend gọi đều có trong openapi.yaml', () => {
    expect(unexpected('frontendNotInSpec')).toEqual([])
  })

  it('CT-03 (quy tắc B) frontend gọi API của module backend đã làm thì backend phải có route đó', () => {
    expect(unexpected('frontendNotInBackend')).toEqual([])
  })

  it('CT-04 (quy tắc C) mọi route backend đều có trong openapi.yaml', () => {
    expect(unexpected('backendNotInSpec')).toEqual([])
  })

  it('CT-06 mọi hành động audit log backend ghi đều có nhãn tiếng Việt trong ACTION_LABELS', () => {
    expect(backendAuditActions().size).toBeGreaterThanOrEqual(10)
    expect(unexpected('auditActionWithoutLabel')).toEqual([])
  })

  it('CT-05 danh sách lệch đã biết không còn mục nào đã được sửa', () => {
    for (const rule of Object.keys(KNOWN_MISMATCHES)) {
      const fixed = KNOWN_MISMATCHES[rule].filter((item) => !mismatches[rule].includes(item))
      expect(fixed, `${rule}: đã khớp, hãy xóa khỏi KNOWN_MISMATCHES`).toEqual([])
    }
  })
})
