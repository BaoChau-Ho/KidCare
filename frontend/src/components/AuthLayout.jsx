import { ROLES } from '../services/auth.js'

// Shared split layout for register / set-password pages
export default function AuthLayout({ children }) {
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
        <div className="login-card wide">{children}</div>
      </main>
    </div>
  )
}