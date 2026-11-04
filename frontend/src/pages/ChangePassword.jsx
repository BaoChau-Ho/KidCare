import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import PasswordRules from '../components/PasswordRules.jsx'
import { changePassword, getSession, PASSWORD_RULES, ROLES } from '../services/auth.js'

export default function ChangePassword() {
  const session = getSession()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  if (!session) return <Navigate to="/login" replace />
  const home = ROLES[session.user.role].home
  const type = show ? 'text' : 'password'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setErrors({})
    const errs = {}
    if (!current) errs.current = 'Enter your current password'
    if (!PASSWORD_RULES.every((r) => r.test(next))) errs.next = 'Your new password does not meet all the requirements.'
    else if (next !== confirm) errs.confirm = 'Passwords do not match'
    if (Object.keys(errs).length) return setErrors(errs)

    setLoading(true)
    try {
      await changePassword(session.user.email, current, next)
      setDone(true)
    } catch (err) {
      if (err.code === 'WRONG_PASSWORD') setErrors({ current: err.message })
      else if (err.code === 'SAME_PASSWORD') setErrors({ next: err.message })
      else setError('Could not change your password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthLayout>
        <h1>Password changed</h1>
        <p className="sub">Use your new password the next time you sign in.</p>
        <Link className="btn btn-link" to={home}>Back to home</Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} noValidate>
        <h1>Change password</h1>
        <p className="sub">Signed in as {session.user.email}</p>

        {error && <div className="alert" role="alert">{error}</div>}

        <div className="field">
          <label htmlFor="current">Current password</label>
          <input id="current" type={type} autoComplete="current-password" value={current}
            onChange={(e) => setCurrent(e.target.value)} aria-invalid={!!errors.current} />
          {errors.current && <span className="field-err">{errors.current}</span>}
        </div>

        <div className="field">
          <label htmlFor="next">New password</label>
          <div className="pw-wrap">
            <input id="next" type={type} autoComplete="new-password" value={next}
              onChange={(e) => setNext(e.target.value)} aria-invalid={!!errors.next} />
            <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)}>{show ? 'Hide' : 'Show'}</button>
          </div>
          {errors.next && <span className="field-err">{errors.next}</span>}
        </div>

        <PasswordRules password={next} />

        <div className="field">
          <label htmlFor="confirm">Confirm new password</label>
          <input id="confirm" type={type} autoComplete="new-password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!errors.confirm} />
          {errors.confirm && <span className="field-err">{errors.confirm}</span>}
        </div>

        <button className="btn" type="submit" disabled={loading}>{loading ? 'Saving...' : 'Change password'}</button>
        <p className="switch"><Link to={home}>Cancel</Link></p>
      </form>
    </AuthLayout>
  )
}