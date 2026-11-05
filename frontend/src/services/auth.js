// Auth service (MOCK). Data for registration lives in localStorage so the
// register page, the admin page and the set-password page can share it.
// Replace each function body with a fetch to your backend when it exists.
// NOTE: never store passwords or national IDs in the browser in production.
//
// CHANGED (UC-03): sign in now also reads the accounts managed on /admin/users
// (kho dùng chung trong mockDb.js). Accounts created, locked or re-roled there
// take effect here immediately.
import { loadDb as loadManaged, saveDb as saveManaged } from './mockDb.js'

export const ROLES = {
  parent: { label: 'Phụ huynh', home: '/parent' },
  teacher: { label: 'Giáo viên', home: '/teacher' },
  medical: { label: 'Nhân viên y tế', home: '/medical' },
  manager: { label: 'Quản lý cơ sở', home: '/manager' },
  admin: { label: 'Quản trị viên', home: '/admin' },
}
// Roles a person can pick when registering (admin accounts are issued by the system)
export const REGISTER_ROLES = ['parent', 'teacher', 'medical', 'manager']

// Built-in demo accounts (shared password: Password@123)
const MOCK_USERS = [
  { email: 'parent@demo.com', role: 'parent', status: 'active' },
  { email: 'teacher@demo.com', role: 'teacher', status: 'active' },
  { email: 'medical@demo.com', role: 'medical', status: 'active' },
  { email: 'manager@demo.com', role: 'manager', status: 'active' },
  { email: 'admin@demo.com', role: 'admin', status: 'active' },
  { email: 'pending@demo.com', role: 'parent', status: 'pending' },
  { email: 'disabled@demo.com', role: 'teacher', status: 'disabled' },
]
const MOCK_PASSWORD = 'Password@123'

// ---------- accounts managed by the admin (UC-03) ----------
// API role (ADMIN, MEDICAL_STAFF...) <-> key of ROLES (admin, medical...)
const API_ROLE = { ADMIN: 'admin', MANAGER: 'manager', TEACHER: 'teacher', MEDICAL_STAFF: 'medical', PARENT: 'parent' }
const TO_API = Object.fromEntries(Object.entries(API_ROLE).map(([k, v]) => [v, k]))
const findManaged = (email) => loadManaged().users.find((u) => u.email === email) ?? null
const managedPassword = (email) => loadManaged().credentials?.[email]

const toManaged = (u) => ({
  id: crypto.randomUUID(), fullName: u.fullName || u.email, email: u.email, phone: u.phone || null,
  role: TO_API[u.role], status: 'ACTIVE', createdAt: u.createdAt || new Date().toISOString(),
})

/** An account activated through registration also shows up on the admin's account list */
function upsertManaged(user) {
  const db = structuredClone(loadManaged())
  if (db.users.some((u) => u.email === user.email)) return
  db.users.push(toManaged(user))
  saveManaged(db)
}

/**
 * Đồng bộ: thêm vào `db` (kho quản lý) mọi tài khoản đã kích hoạt qua /register mà chưa có trong đó,
 * ví dụ tài khoản kích hoạt trước khi kho quản lý được tạo hoặc đặt lại. Trả về số tài khoản được thêm.
 * Tài khoản đã có trong kho (kể cả bị khóa/ngừng hoạt động) không bị thêm lại.
 */
export function syncRegisteredInto(db) {
  let added = 0
  for (const u of readDb().users) {
    if (u.status === 'active' && !u.seed && !db.users.some((x) => x.email === u.email)) { db.users.push(toManaged(u)); added += 1 }
  }
  return added
}

// ---------- tiny mock database ----------
const DB_KEY = 'mock_db'
const LINK_TTL_MS = 24 * 60 * 60 * 1000 // set-password link valid for 24h
const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms))
const readDb = () => {
  try { return JSON.parse(localStorage.getItem(DB_KEY)) || { users: [], outbox: [] } }
  catch { return { users: [], outbox: [] } }
}
const writeDb = (db) => localStorage.setItem(DB_KEY, JSON.stringify(db))
const randomHex = (bytes = 16) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('')
const fail = (message, code) => Object.assign(new Error(message), { code })

function sendMail(db, to, subject, body, link) {
  db.outbox.unshift({ id: randomHex(4), to, subject, body, link, sentAt: new Date().toISOString() })
}
function issueLink(db, user) {
  user.token = randomHex()
  user.tokenExpires = Date.now() + LINK_TTL_MS
  sendMail(
    db, user.email, 'Đặt mật khẩu của bạn',
    'Yêu cầu đăng ký của bạn đã được duyệt. Dùng liên kết này để tạo mật khẩu (có hiệu lực 24 giờ).',
    `${window.location.origin}/set-password?token=${user.token}`
  )
}

// ---------- password rules (use case 1.2, step 5) ----------
export const PASSWORD_RULES = [
  { id: 'len', label: 'Ít nhất 8 ký tự', test: (p) => p.length >= 8 },
  { id: 'lower', label: 'Có chữ thường', test: (p) => /[a-z]/.test(p) },
  { id: 'upper', label: 'Có chữ hoa', test: (p) => /[A-Z]/.test(p) },
  { id: 'digit', label: 'Có chữ số', test: (p) => /\d/.test(p) },
  { id: 'special', label: 'Có ký tự đặc biệt', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

// ---------- use case 1.1: sign in ----------
/**
 * Returns { user, token } on success.
 * Throws an error with `code`: INVALID_CREDENTIALS | PENDING | DISABLED | REJECTED
 */
export async function login(email, password) {
  // With a backend:
  // const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  // const data = await res.json()
  // if (!res.ok) throw fail(data.message, data.code)
  // return data
  await delay(600)
  const e = email.toLowerCase()

  // Admin-managed account: a locked / inactive account can never sign in (UC-03 S3)
  const managed = findManaged(e)
  if (managed && managed.status !== 'ACTIVE') {
    throw fail(managed.status === 'LOCKED' ? 'Tài khoản của bạn đã bị quản trị viên khóa' : 'Tài khoản của bạn đã bị vô hiệu hóa', 'DISABLED')
  }
  const roleOf = (fallback) => (managed ? API_ROLE[managed.role] : fallback) // role set by the admin wins

  const registered = [...readDb().users].reverse().find((u) => u.email === e)
  if (registered) {
    if (registered.status === 'active') {
      if (registered.password !== password) throw fail('Email hoặc mật khẩu không đúng', 'INVALID_CREDENTIALS')
      return { user: { email: e, role: roleOf(registered.role) }, token: 'mock-token' }
    }
    if (registered.status === 'rejected') throw fail('Yêu cầu đăng ký của bạn đã bị từ chối', 'REJECTED')
    throw fail('Tài khoản của bạn chưa được kích hoạt. Hãy chờ admin duyệt, sau đó dùng liên kết trong email để đặt mật khẩu.', 'PENDING')
  }

  const user = MOCK_USERS.find((u) => u.email === e)

  // Accounts created by the admin on /admin/users (sign in with the temporary password)
  if (managed && !user) {
    if (managedPassword(e) !== password) throw fail('Email hoặc mật khẩu không đúng', 'INVALID_CREDENTIALS')
    return { user: { email: e, role: API_ROLE[managed.role] }, token: 'mock-token' }
  }

  if (!user || password !== MOCK_PASSWORD) throw fail('Email hoặc mật khẩu không đúng', 'INVALID_CREDENTIALS')
  if (user.status === 'pending') throw fail('Tài khoản của bạn đang chờ admin duyệt', 'PENDING')
  if (user.status === 'disabled') throw fail('Tài khoản của bạn đã bị vô hiệu hóa', 'DISABLED')
  return { user: { email: e, role: roleOf(user.role) }, token: 'mock-token' }
}

// ---------- use case 1.2: register ----------
/** Steps 1-2: validate and save the request as "pending". Throws EMAIL_EXISTS | ID_EXISTS */
export async function registerRequest({ fullName, email, phone, role, nationalId }) {
  await delay()
  const db = readDb()
  const e = email.trim().toLowerCase()
  const taken = db.users.some((u) => u.email === e && u.status !== 'rejected') || MOCK_USERS.some((u) => u.email === e) || !!findManaged(e)
  if (taken) throw fail('Email này đã được đăng ký', 'EMAIL_EXISTS')
  if (db.users.some((u) => u.nationalId === nationalId && u.status !== 'rejected'))
    throw fail('Số CCCD này đã được đăng ký', 'ID_EXISTS')
  db.users.push({
    id: randomHex(6), fullName: fullName.trim(), email: e, phone: phone.trim(), role, nationalId,
    status: 'pending', createdAt: new Date().toISOString(),
  })
  writeDb(db)
}

// Step 3 (admin)
export async function listRequests() {
  await delay(150)
  return [...readDb().users].filter((u) => !u.seed).reverse()
}
export async function listOutbox() {
  await delay(150)
  return readDb().outbox
}
export async function approveRequest(id) {
  await delay(300)
  const db = readDb()
  const user = db.users.find((u) => u.id === id && u.status === 'pending')
  if (!user) throw fail('Không tìm thấy yêu cầu', 'NOT_FOUND')
  user.status = 'approved'
  issueLink(db, user) // Step 4: email with set-password link
  writeDb(db)
}
export async function rejectRequest(id, reason) {
  await delay(300)
  const db = readDb()
  const user = db.users.find((u) => u.id === id && u.status === 'pending')
  if (!user) throw fail('Không tìm thấy yêu cầu', 'NOT_FOUND')
  user.status = 'rejected'
  user.reason = reason
  sendMail(db, user.email, 'Yêu cầu đăng ký bị từ chối', `Yêu cầu đăng ký của bạn đã bị từ chối. Lý do: ${reason}`)
  writeDb(db)
}

// Steps 4-5: set-password link
/** Returns { status: 'valid' | 'expired' | 'invalid', email? } */
export async function checkToken(token) {
  await delay(250)
  const user = readDb().users.find((u) => u.token && u.token === token && u.status === 'approved')
  if (!user) return { status: 'invalid' }
  if (Date.now() > user.tokenExpires) return { status: 'expired', email: user.email }
  return { status: 'valid', email: user.email }
}
/** 5b: send a fresh link when the old one has expired */
export async function resendLink(token) {
  await delay(300)
  const db = readDb()
  const user = db.users.find((u) => u.token === token && u.status === 'approved')
  if (!user) throw fail('Không tìm thấy liên kết', 'INVALID_TOKEN')
  issueLink(db, user)
  writeDb(db)
}
/** Step 6: save the password and activate the account */
export async function setPassword(token, password) {
  await delay(500)
  const db = readDb()
  const user = db.users.find((u) => u.token === token && u.status === 'approved')
  if (!user) throw fail('Liên kết không hợp lệ', 'INVALID_TOKEN')
  if (Date.now() > user.tokenExpires) throw fail('Liên kết đã hết hạn', 'EXPIRED')
  if (!PASSWORD_RULES.every((r) => r.test(password))) throw fail('Mật khẩu chưa đủ mạnh', 'WEAK_PASSWORD')
  user.password = password
  user.status = 'active'
  delete user.token
  delete user.tokenExpires
  writeDb(db)
  upsertManaged(user) // now visible on /admin/users
}

// ---------- use case 1.3: forgot / change password ----------
const RESET_TTL_MS = 60 * 60 * 1000 // reset link valid for 1h

// Returns the active account record for an email.
// Demo accounts and admin-created accounts are copied into the mock db on first use.
function activeDbUser(db, email) {
  let u = [...db.users].reverse().find((x) => x.email === email)
  if (u) return u.status === 'active' ? u : null

  const seed = MOCK_USERS.find((x) => x.email === email && x.status === 'active')
  const managed = findManaged(email)
  const password = seed ? MOCK_PASSWORD : managedPassword(email)
  if ((!seed && !managed) || !password || (managed && managed.status !== 'ACTIVE')) return null

  u = {
    id: randomHex(6), seed: true, fullName: managed?.fullName ?? email, email, phone: '', nationalId: '',
    role: managed ? API_ROLE[managed.role] : seed.role,
    status: 'active', password, createdAt: new Date().toISOString(),
  }
  db.users.push(u)
  return u
}

/** Steps 1-3: always resolves, so the page never reveals whether an email has an account */
export async function requestPasswordReset(email) {
  await delay(500)
  const db = readDb()
  const user = activeDbUser(db, email.trim().toLowerCase())
  if (user) {
    user.resetToken = randomHex()
    user.resetExpires = Date.now() + RESET_TTL_MS
    sendMail(
      db, user.email, 'Đặt lại mật khẩu',
      'Chúng tôi nhận được yêu cầu đặt lại mật khẩu của bạn. Liên kết có hiệu lực 1 giờ. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.',
      `${window.location.origin}/reset-password?token=${user.resetToken}`
    )
  }
  writeDb(db)
}
/** Returns { status: 'valid' | 'expired' | 'invalid', email? } */
export async function checkResetToken(token) {
  await delay(250)
  const user = readDb().users.find((u) => u.resetToken && u.resetToken === token && u.status === 'active')
  if (!user) return { status: 'invalid' }
  if (Date.now() > user.resetExpires) return { status: 'expired', email: user.email }
  return { status: 'valid', email: user.email }
}
/** Step 5: save the new password and invalidate the link */
export async function resetPassword(token, password) {
  await delay(500)
  const db = readDb()
  const user = db.users.find((u) => u.resetToken && u.resetToken === token && u.status === 'active')
  if (!user) throw fail('Liên kết không hợp lệ', 'INVALID_TOKEN')
  if (Date.now() > user.resetExpires) throw fail('Liên kết đã hết hạn', 'EXPIRED')
  if (!PASSWORD_RULES.every((r) => r.test(password))) throw fail('Mật khẩu chưa đủ mạnh', 'WEAK_PASSWORD')
  user.password = password
  delete user.resetToken
  delete user.resetExpires
  writeDb(db)
}
/** Signed-in user changes password. Throws WRONG_PASSWORD | SAME_PASSWORD | WEAK_PASSWORD */
export async function changePassword(email, current, next) {
  await delay(500)
  const db = readDb()
  const user = activeDbUser(db, email)
  if (!user) throw fail('Không tìm thấy tài khoản', 'NOT_FOUND')
  if (user.password !== current) throw fail('Mật khẩu hiện tại không đúng', 'WRONG_PASSWORD')
  if (next === current) throw fail('Mật khẩu mới phải khác mật khẩu hiện tại', 'SAME_PASSWORD')
  if (!PASSWORD_RULES.every((r) => r.test(next))) throw fail('Mật khẩu chưa đủ mạnh', 'WEAK_PASSWORD')
  user.password = next
  writeDb(db)
}

// ---------- session ----------
export function saveSession(session) {
  sessionStorage.setItem('session', JSON.stringify(session))
}
export function getSession() {
  try { return JSON.parse(sessionStorage.getItem('session')) } catch { return null }
}
export function clearSession() {
  sessionStorage.removeItem('session')
}