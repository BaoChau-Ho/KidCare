import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import { requestPasswordReset } from '../services/auth.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!EMAIL_RE.test(email.trim())) return setError('Nhập địa chỉ email hợp lệ')
    setLoading(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch {
      setError('Không thể gửi yêu cầu. Vui lòng thử lại sau.')
    } finally {
      setLoading(false)
    }
  }

  // Cùng một thông báo dù email có tài khoản hay không (tránh dò tài khoản)
  if (sent) {
    return (
      <AuthLayout>
        <h1>Kiểm tra email của bạn</h1>
        <p className="sub">
          Nếu có tài khoản đang hoạt động với <strong>{email.trim()}</strong>, chúng tôi đã gửi liên kết đặt lại mật khẩu.
          Liên kết có hiệu lực trong 1 giờ.
        </p>
        <Link className="btn btn-link" to="/login">Về trang đăng nhập</Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} noValidate>
        <h1>Quên mật khẩu?</h1>
        <p className="sub">Nhập email, chúng tôi sẽ gửi liên kết để bạn chọn mật khẩu mới.</p>

        {error && <div className="alert" role="alert">{error}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <button className="btn" type="submit" disabled={loading}>{loading ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}</button>
        <p className="switch"><Link to="/login">Về trang đăng nhập</Link></p>
      </form>
    </AuthLayout>
  )
}