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
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address')
    setLoading(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch {
      setError('Could not send the request. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  // Same message whether or not the email has an account (prevents account guessing)
  if (sent) {
    return (
      <AuthLayout>
        <h1>Check your email</h1>
        <p className="sub">
          If an active account exists for <strong>{email.trim()}</strong>, we sent a link to reset your password.
          The link is valid for 1 hour.
        </p>
        <Link className="btn btn-link" to="/login">Back to sign in</Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} noValidate>
        <h1>Forgot your password?</h1>
        <p className="sub">Enter your email and we&rsquo;ll send you a link to choose a new one.</p>

        {error && <div className="alert" role="alert">{error}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <button className="btn" type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send reset link'}</button>
        <p className="switch"><Link to="/login">Back to sign in</Link></p>
      </form>
    </AuthLayout>
  )
}