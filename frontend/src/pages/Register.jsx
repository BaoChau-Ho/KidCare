import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import { registerRequest, ROLES, REGISTER_ROLES } from '../services/auth.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?\d{9,12}$/
const ID_RE = /^\d{12}$/ // Vietnamese citizen ID (CCCD) has 12 digits

export default function Register() {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', role: '', nationalId: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const validate = () => {
    const errs = {}
    if (form.fullName.trim().length < 2) errs.fullName = 'Enter your full name'
    if (!EMAIL_RE.test(form.email)) errs.email = 'Enter a valid email address'
    if (!PHONE_RE.test(form.phone.replace(/\s/g, ''))) errs.phone = 'Enter a valid phone number'
    if (!form.role) errs.role = 'Choose your role'
    if (!ID_RE.test(form.nationalId)) errs.nationalId = 'National ID (CCCD) must be 12 digits'
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
      // 2a: duplicate email / national ID
      if (err.code === 'EMAIL_EXISTS') setErrors({ email: err.message })
      else if (err.code === 'ID_EXISTS') setErrors({ nationalId: err.message })
      else setError('Could not submit your request. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthLayout>
        <h1>Request submitted</h1>
        <p className="sub">
          An admin will review your information. When it is approved, we will email <strong>{form.email}</strong> a
          link to create your password.
        </p>
        <Link className="btn btn-link" to="/login">Back to sign in</Link>
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
        <h1>Create an account</h1>
        <p className="sub">Your request is reviewed by an admin before the account is activated.</p>

        {error && <div className="alert" role="alert">{error}</div>}

        {field('fullName', 'Full name', { autoComplete: 'name' })}
        {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
        {field('phone', 'Phone number', { type: 'tel', autoComplete: 'tel' })}

        <div className="field">
          <label htmlFor="role">I am a</label>
          <select id="role" value={form.role} onChange={set('role')} aria-invalid={!!errors.role}>
            <option value="">Choose a role</option>
            {REGISTER_ROLES.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
          </select>
          {errors.role && <span className="field-err">{errors.role}</span>}
        </div>

        {field('nationalId', 'National ID (CCCD)', { inputMode: 'numeric', maxLength: 12, autoComplete: 'off' })}
        <p className="hint">Used only to verify your identity. Only admins can see it.</p>

        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit request'}
        </button>
        <p className="switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </form>
    </AuthLayout>
  )
}