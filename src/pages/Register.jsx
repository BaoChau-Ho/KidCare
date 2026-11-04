import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import Select from '../components/Select.jsx'
import { registerRequest, ROLES, REGISTER_ROLES } from '../services/auth.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?\d{9,12}$/
const ID_RE = /^\d{12}$/ // CCCD Việt Nam gồm 12 chữ số

export default function Register() {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', role: '', nationalId: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const validate = () => {
    const errs = {}
    if (form.fullName.trim().length < 2) errs.fullName = 'Nhập họ và tên'
    if (!EMAIL_RE.test(form.email)) errs.email = 'Email không hợp lệ'
    if (!PHONE_RE.test(form.phone.replace(/\s/g, ''))) errs.phone = 'Số điện thoại không hợp lệ'
    if (!form.role) errs.role = 'Chọn vai trò của bạn'
    if (!ID_RE.test(form.nationalId)) errs.nationalId = 'Số CCCD phải gồm 12 chữ số'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!validate()) return
    setLoading(true)
    try {
      await registerRequest({ ...form, phone: form.phone.replace(/\s/g, '') })
      setDone(true)
    } catch (err) {
      // 2a: trùng email / CCCD
      if (err.code === 'EMAIL_EXISTS') setErrors({ email: err.message })
      else if (err.code === 'ID_EXISTS') setErrors({ nationalId: err.message })
      else setError('Không thể gửi yêu cầu. Vui lòng thử lại sau.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthLayout>
        <h1>Đã gửi yêu cầu</h1>
        <p className="sub">
          Admin sẽ xem xét thông tin của bạn. Khi được duyệt, chúng tôi sẽ gửi email đến <strong>{form.email}</strong> kèm
          liên kết để tạo mật khẩu.
        </p>
        <Link className="btn btn-link" to="/login">Về trang đăng nhập</Link>
      </AuthLayout>
    )
  }

  const field = (id, label, props = {}) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id} value={form[id]} onChange={set(id)} aria-invalid={!!errors[id]}
        aria-describedby={errors[id] ? `${id}-err` : undefined} {...props}
      />
      {errors[id] && <span id={`${id}-err`} className="field-err">{errors[id]}</span>}
    </div>
  )

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} noValidate>
        <h1>Tạo tài khoản</h1>
        <p className="sub">Yêu cầu của bạn được admin xem xét trước khi tài khoản được kích hoạt.</p>

        {error && <div className="alert" role="alert">{error}</div>}

        {field('fullName', 'Họ và tên', { autoComplete: 'name' })}
        {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
        {field('phone', 'Số điện thoại', { type: 'tel', autoComplete: 'tel' })}

        <div className="field">
          <label htmlFor="role">Tôi là</label>
          <Select id="role" value={form.role} onChange={set('role')} aria-invalid={!!errors.role} aria-describedby={errors.role ? 'role-err' : undefined}>
            <option value="">Chọn vai trò</option>
            {REGISTER_ROLES.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
          </Select>
          {errors.role && <span id="role-err" className="field-err">{errors.role}</span>}
        </div>

        {field('nationalId', 'Số CCCD', { inputMode: 'numeric', maxLength: 12, autoComplete: 'off' })}
        <p className="hint">Chỉ dùng để xác minh danh tính. Chỉ admin xem được.</p>

        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Đang gửi...' : 'Gửi yêu cầu'}
        </button>
        <p className="switch">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
      </form>
    </AuthLayout>
  )
}
