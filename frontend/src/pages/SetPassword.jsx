import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import PasswordRules from '../components/PasswordRules.jsx'
import {
  checkToken, resendLink, setPassword, checkResetToken, resetPassword, PASSWORD_RULES,
} from '../services/auth.js'

// One page, two flows:
//  mode "set":   first password after admin approval (use case 1.2)
//  mode "reset": new password from a "forgot password" email (use case 1.3)
const MODES = {
  set: {
    check: checkToken, submit: setPassword, title: 'Create your password', button: 'Set password',
    done: 'Your password is set and your account is active. Sign in to continue.',
    expired: 'For your security, set-password links expire after 24 hours.',
  },
  reset: {
    check: checkResetToken, submit: resetPassword, title: 'Choose a new password', button: 'Reset password',
    done: 'Your password has been reset. Sign in with your new password.',
    expired: 'Reset links expire after 1 hour.',
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
    if (!strong) return setError('Your password does not meet all the requirements below.')
    if (password !== confirm) return setConfirmErr('Passwords do not match')
    setLoading(true)
    try {
      await cfg.submit(token, password)
      navigate('/login', { replace: true, state: { notice: cfg.done } })
    } catch (err) {
      if (err.code === 'EXPIRED') setLink({ status: 'expired' })
      else if (err.code === 'INVALID_TOKEN') setLink({ status: 'invalid' })
      else setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    try { await resendLink(token); setResent(true) } catch { setLink({ status: 'invalid' }) }
  }

  if (link.status === 'loading') return <AuthLayout><p className="sub">Checking your link...</p></AuthLayout>

  if (link.status === 'invalid') {
    return (
      <AuthLayout>
        <h1>Link not valid</h1>
        <p className="sub">This link was already used or is incorrect.</p>
        <Link className="btn btn-link" to={mode === 'reset' ? '/forgot-password' : '/login'}>
          {mode === 'reset' ? 'Request a new link' : 'Go to sign in'}
        </Link>
      </AuthLayout>
    )
  }

  if (link.status === 'expired') {
    return (
      <AuthLayout>
        <h1>Link expired</h1>
        <p className="sub">{cfg.expired}</p>
        {mode === 'reset' && <Link className="btn btn-link" to="/forgot-password">Request a new link</Link>}
        {mode === 'set' && (resent
          ? <div className="notice" role="status">A new link has been sent to {link.email}.</div>
          : <button className="btn" onClick={handleResend}>Send me a new link</button>)}
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} noValidate>
        <h1>{cfg.title}</h1>
        <p className="sub">Account: {link.email}</p>

        {error && <div className="alert" role="alert">{error}</div>}

        <div className="field">
          <label htmlFor="pw">New password</label>
          <div className="pw-wrap">
            <input id="pw" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPw(e.target.value)} />
            <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)}>{show ? 'Hide' : 'Show'}</button>
          </div>
        </div>

        <PasswordRules password={password} />

        <div className="field">
          <label htmlFor="confirm">Confirm password</label>
          <input id="confirm" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!confirmErr} />
          {confirmErr && <span className="field-err">{confirmErr}</span>}
        </div>

        <button className="btn" type="submit" disabled={loading}>{loading ? 'Saving...' : cfg.button}</button>
      </form>
    </AuthLayout>
  )
}