import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { login, saveSession, ROLES } from '../services/auth.js'

const MAX_ATTEMPTS = 5
const LOCK_SECONDS = 30
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const navigate = useNavigate()
  const notice = useLocation().state?.notice
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(0)

  const validate = () => {
    const errs = {}
    if (!email.trim()) errs.email = 'Enter your email'
    else if (!EMAIL_RE.test(email)) errs.email = 'Enter a valid email address'
    if (!password) errs.password = 'Enter your password'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // 2b. Temporary lock after too many failed attempts
    const remain = Math.ceil((lockedUntil - Date.now()) / 1000)
    if (remain > 0) {
      setError(`Too many failed attempts. Try again in ${remain} seconds.`)
      return
    }
    if (!validate()) return

    setLoading(true)
    try {
      const session = await login(email.trim(), password)
      saveSession(session)
      // Main flow 3-4: redirect to the home page for the user's role
      navigate(ROLES[session.user.role].home, { replace: true })
    } catch (err) {
      if (err.code === 'INVALID_CREDENTIALS') {
        const next = attempts + 1
        setAttempts(next)
        if (next >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCK_SECONDS * 1000)
          setAttempts(0)
          setError(`${MAX_ATTEMPTS} failed attempts in a row. Sign in is locked for ${LOCK_SECONDS} seconds.`)
        } else {
          setError('Incorrect email or password. Check your details, or register if you don\u2019t have an account.')
        }
      } else {
        // 2c. Pending approval / disabled account
        setError(err.message || 'Unable to sign in. Please try again later.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <aside className="login-aside" aria-hidden="true">
        <div className="aside-inner">
          <h2>One place for the whole school</h2>
          <p>Parents, teachers, medical staff and facility managers track children&rsquo;s health and daily activities together.</p>
          <ul className="role-list">
            {Object.values(ROLES).filter((r) => r.label !== 'Admin').map((r) => (
              <li key={r.label}>{r.label}</li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="login-main">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <h1>Sign in</h1>
          <p className="sub">Use the email and password you registered with.</p>

          {notice && !error && <div className="notice" role="status">{notice}</div>}
          {error && <div className="alert" role="alert">{error}</div>}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email" type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-err' : undefined}
            />
            {fieldErrors.email && <span id="email-err" className="field-err">{fieldErrors.email}</span>}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="pw-wrap">
              <input
                id="password" type={showPw ? 'text' : 'password'} autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'pw-err' : undefined}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPw((v) => !v)}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
            {fieldErrors.password && <span id="pw-err" className="field-err">{fieldErrors.password}</span>}
          </div>

          <div className="row-end">
            <Link to="/forgot-password">Forgot password?</Link>
          </div>

          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <p className="switch">Don&rsquo;t have an account? <Link to="/register">Register</Link></p>
        </form>
      </main>
    </div>
  )
}