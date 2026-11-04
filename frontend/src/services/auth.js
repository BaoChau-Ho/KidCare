// Auth service (MOCK). Data for registration lives in localStorage so the
// register page, the admin page and the set-password page can share it.
// Replace each function body with a fetch to your backend when it exists.
// NOTE: never store passwords or national IDs in the browser in production.

export const ROLES = {
  parent: { label: 'Parent', home: '/parent' },
  teacher: { label: 'Teacher', home: '/teacher' },
  medical: { label: 'Medical staff', home: '/medical' },
  manager: { label: 'Facility manager', home: '/manager' },
  admin: { label: 'Admin', home: '/admin' },
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
    db, user.email, 'Set your password',
    'Your registration was approved. Use this link to create your password (valid for 24 hours).',
    `${window.location.origin}/set-password?token=${user.token}`
  )
}

// ---------- password rules (use case 1.2, step 5) ----------
export const PASSWORD_RULES = [
  { id: 'len', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'lower', label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'upper', label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'digit', label: 'A number', test: (p) => /\d/.test(p) },
  { id: 'special', label: 'A special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
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

  const registered = [...readDb().users].reverse().find((u) => u.email === e)
  if (registered) {
    if (registered.status === 'active') {
      if (registered.password !== password) throw fail('Incorrect email or password', 'INVALID_CREDENTIALS')
      return { user: { email: e, role: registered.role }, token: 'mock-token' }
    }
    if (registered.status === 'rejected') throw fail('Your registration was rejected', 'REJECTED')
    throw fail('Your account is not active yet. Wait for admin approval, then use the link in your email to set a password.', 'PENDING')
  }

  const user = MOCK_USERS.find((u) => u.email === e)
  if (!user || password !== MOCK_PASSWORD) throw fail('Incorrect email or password', 'INVALID_CREDENTIALS')
  if (user.status === 'pending') throw fail('Your account is waiting for admin approval', 'PENDING')
  if (user.status === 'disabled') throw fail('Your account has been disabled', 'DISABLED')
  return { user, token: 'mock-token' }
}

// ---------- use case 1.2: register ----------
/** Steps 1-2: validate and save the request as "pending". Throws EMAIL_EXISTS | ID_EXISTS */
export async function registerRequest({ fullName, email, phone, role, nationalId }) {
  await delay()
  const db = readDb()
  const e = email.trim().toLowerCase()
  const taken = db.users.some((u) => u.email === e && u.status !== 'rejected') || MOCK_USERS.some((u) => u.email === e)
  if (taken) throw fail('This email is already registered', 'EMAIL_EXISTS')
  if (db.users.some((u) => u.nationalId === nationalId && u.status !== 'rejected'))
    throw fail('This national ID is already registered', 'ID_EXISTS')
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
  if (!user) throw fail('Request not found', 'NOT_FOUND')
  user.status = 'approved'
  issueLink(db, user) // Step 4: email with set-password link
  writeDb(db)
}
export async function rejectRequest(id, reason) {
  await delay(300)
  const db = readDb()
  const user = db.users.find((u) => u.id === id && u.status === 'pending')
  if (!user) throw fail('Request not found', 'NOT_FOUND')
  user.status = 'rejected'
  user.reason = reason
  sendMail(db, user.email, 'Registration rejected', `Your registration was rejected. Reason: ${reason}`)
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
  if (!user) throw fail('Link not found', 'INVALID_TOKEN')
  issueLink(db, user)
  writeDb(db)
}
/** Step 6: save the password and activate the account */
export async function setPassword(token, password) {
  await delay(500)
  const db = readDb()
  const user = db.users.find((u) => u.token === token && u.status === 'approved')
  if (!user) throw fail('This link is not valid', 'INVALID_TOKEN')
  if (Date.now() > user.tokenExpires) throw fail('This link has expired', 'EXPIRED')
  if (!PASSWORD_RULES.every((r) => r.test(password))) throw fail('Password is not strong enough', 'WEAK_PASSWORD')
  user.password = password
  user.status = 'active'
  delete user.token
  delete user.tokenExpires
  writeDb(db)
}

// ---------- use case 1.3: forgot / change password ----------
const RESET_TTL_MS = 60 * 60 * 1000 // reset link valid for 1h

// Returns the active account record for an email (demo accounts are copied into the mock db on first use)
function activeDbUser(db, email) {
  let u = [...db.users].reverse().find((x) => x.email === email)
  if (u) return u.status === 'active' ? u : null
  const seed = MOCK_USERS.find((x) => x.email === email && x.status === 'active')
  if (!seed) return null
  u = {
    id: randomHex(6), seed: true, fullName: email, email, phone: '', nationalId: '', role: seed.role,
    status: 'active', password: MOCK_PASSWORD, createdAt: new Date().toISOString(),
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
      db, user.email, 'Reset your password',
      'We received a request to reset your password. The link is valid for 1 hour. If you did not ask for this, ignore this email.',
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
  if (!user) throw fail('This link is not valid', 'INVALID_TOKEN')
  if (Date.now() > user.resetExpires) throw fail('This link has expired', 'EXPIRED')
  if (!PASSWORD_RULES.every((r) => r.test(password))) throw fail('Password is not strong enough', 'WEAK_PASSWORD')
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
  if (!user) throw fail('Account not found', 'NOT_FOUND')
  if (user.password !== current) throw fail('Current password is incorrect', 'WRONG_PASSWORD')
  if (next === current) throw fail('New password must be different from the current one', 'SAME_PASSWORD')
  if (!PASSWORD_RULES.every((r) => r.test(next))) throw fail('Password is not strong enough', 'WEAK_PASSWORD')
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