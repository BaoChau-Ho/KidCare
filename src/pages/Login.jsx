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
    if (!email.trim()) errs.email = 'Nhập email'
    else if (!EMAIL_RE.test(email)) errs.email = 'Email không hợp lệ'
    if (!password) errs.password = 'Nhập mật khẩu'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // 2b. Khóa tạm thời khi nhập sai quá nhiều lần
    const remain = Math.ceil((lockedUntil - Date.now()) / 1000)
    if (remain > 0) {
      setError(`Bạn đã nhập sai quá nhiều lần. Thử lại sau ${remain} giây.`)
      return
    }
    if (!validate()) return

    setLoading(true)
    try {
      const session = await login(email.trim(), password)
      saveSession(session)
      // Luồng chính 3-4: chuyển tới trang chủ theo vai trò
      navigate(ROLES[session.user.role].home, { replace: true })
    } catch (err) {
      if (err.code === 'INVALID_CREDENTIALS') {
        const next = attempts + 1
        setAttempts(next)
        if (next >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCK_SECONDS * 1000)
          setAttempts(0)
          setError(`Sai ${MAX_ATTEMPTS} lần liên tiếp. Đăng nhập bị khóa trong ${LOCK_SECONDS} giây.`)
        } else {
          setError('Email hoặc mật khẩu không đúng. Kiểm tra lại thông tin, hoặc đăng ký nếu bạn chưa có tài khoản.')
        }
      } else {
        // 2c. Chờ duyệt / tài khoản bị khóa
        setError(err.message || 'Không thể đăng nhập. Vui lòng thử lại sau.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <aside className="login-aside" aria-hidden="true">
        <div className="aside-inner">
          <h2>Một nơi chung cho cả trường</h2>
          <p>Phụ huynh, giáo viên, nhân viên y tế và quản lý cơ sở cùng theo dõi sức khỏe và hoạt động hằng ngày của trẻ.</p>
          <ul className="role-list">
            {Object.entries(ROLES).filter(([key]) => key !== 'admin').map(([key, r]) => (
              <li key={key}>{r.label}</li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="login-main">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <h1>Đăng nhập</h1>
          <p className="sub">Dùng email và mật khẩu bạn đã đăng ký.</p>

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
            <label htmlFor="password">Mật khẩu</label>
            <div className="pw-wrap">
              <input
                id="password" type={showPw ? 'text' : 'password'} autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'pw-err' : undefined}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPw((v) => !v)}>
                {showPw ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
            {fieldErrors.password && <span id="pw-err" className="field-err">{fieldErrors.password}</span>}
          </div>

          <div className="row-end">
            <Link to="/forgot-password">Quên mật khẩu?</Link>
          </div>

          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>

          <p className="switch">Chưa có tài khoản? <Link to="/register">Đăng ký</Link></p>
        </form>
      </main>
    </div>
  )
}
