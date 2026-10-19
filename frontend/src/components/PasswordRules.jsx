import { PASSWORD_RULES } from '../services/auth.js'

// Live checklist shown under a "new password" field
export default function PasswordRules({ password }) {
  return (
    <ul className="rules" aria-live="polite">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password)
        return <li key={r.id} className={ok ? 'ok' : ''}>{ok ? '\u2713' : '\u2022'} {r.label}</li>
      })}
    </ul>
  )
}