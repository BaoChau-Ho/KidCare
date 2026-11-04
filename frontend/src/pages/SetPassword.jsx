import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import PasswordRules from '../components/PasswordRules.jsx'
import {
  checkToken, resendLink, setPassword, checkResetToken, resetPassword, PASSWORD_RULES,
} from '../services/auth.js'

// Một trang, hai luồng:
//  mode "set":   mật khẩu đầu tiên sau khi admin duyệt (use case 1.2)
//  mode "reset": mật khẩu mới từ email "quên mật khẩu" (use case 1.3)
const MODES = {
  set: {
    check: checkToken, submit: setPassword, title: 'Tạo mật khẩu của bạn', button: 'Đặt mật khẩu',
    done: 'Mật khẩu đã được đặt và tài khoản đã kích hoạt. Hãy đăng nhập để tiếp tục.',
    expired: 'Vì lý do bảo mật, liên kết đặt mật khẩu hết hạn sau 24 giờ.',
  },
  reset: {
    check: checkResetToken, submit: resetPassword, title: 'Chọn mật khẩu mới', button: 'Đặt lại mật khẩu',
    done: 'Mật khẩu đã được đặt lại. Hãy đăng nhập bằng mật khẩu mới.',
    expired: 'Liên kết đặt lại hết hạn sau 1 giờ.',
  },
}

export default function SetPassword({ mode = 'set' }) {
  const cfg = MODES[mode]
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()

  const [link, setLink] = useState({ status: 'loading' }) // loading | valid | expired | invalid
  const [password, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [confirmErr, setConfirmErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [resent, setResent] = useState(false)

  useEffect(() => {
    let alive = true
    cfg.check(token).then((r) => alive && setLink(r))
    return () => { alive = false }
  }, [token, cfg])

  const strong = PASSWORD_RULES.every((r) => r.test(password))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setConfirmErr('')
    if (!strong) return setError('Mật khẩu của bạn chưa đáp ứng đủ các yêu cầu bên dưới.')
    if (password !== confirm) return setConfirmErr('Mật khẩu xác nhận không khớp')
    setLoading(true)
    try {
      await cfg.submit(token, password)
      navigate('/login', { replace: true, state: { notice: cfg.done } })
    } catch (err) {
      if (err.code === 'EXPIRED') setLink({ status: 'expired' })
      else if (err.code === 'INVALID_TOKEN') setLink({ status: 'invalid' })
      else setError('Đã xảy ra lỗi. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    try { await resendLink(token); setResent(true) } catch { setLink({ status: 'invalid' }) }
  }

  if (link.status === 'loading') return <AuthLayout><p className="sub">Đang kiểm tra liên kết...</p></AuthLayout>

  if (link.status === 'invalid') {
    return (
      <AuthLayout>
        <h1>Liên kết không hợp lệ</h1>
        <p className="sub">Liên kết này đã được dùng hoặc không đúng.</p>
        <Link className="btn btn-link" to={mode === 'reset' ? '/forgot-password' : '/login'}>
          {mode === 'reset' ? 'Yêu cầu liên kết mới' : 'Đến trang đăng nhập'}
        </Link>
      </AuthLayout>
    )
  }

  if (link.status === 'expired') {
    return (
      <AuthLayout>
        <h1>Liên kết đã hết hạn</h1>
        <p className="sub">{cfg.expired}</p>
        {mode === 'reset' && <Link className="btn btn-link" to="/forgot-password">Yêu cầu liên kết mới</Link>}
        {mode === 'set' && (resent
          ? <div className="notice" role="status">Một liên kết mới đã được gửi đến {link.email}.</div>
          : <button className="btn" onClick={handleResend}>Gửi liên kết mới cho tôi</button>)}
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} noValidate>
        <h1>{cfg.title}</h1>
        <p className="sub">Tài khoản: {link.email}</p>

        {error && <div className="alert" role="alert">{error}</div>}

        <div className="field">
          <label htmlFor="pw">Mật khẩu mới</label>
          <div className="pw-wrap">
            <input id="pw" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPw(e.target.value)} />
            <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)}>{show ? 'Ẩn' : 'Hiện'}</button>
          </div>
        </div>

        <PasswordRules password={password} />

        <div className="field">
          <label htmlFor="confirm">Xác nhận mật khẩu</label>
          <input id="confirm" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!confirmErr} />
          {confirmErr && <span className="field-err">{confirmErr}</span>}
        </div>

        <button className="btn" type="submit" disabled={loading}>{loading ? 'Đang lưu...' : cfg.button}</button>
      </form>
    </AuthLayout>
  )
}
