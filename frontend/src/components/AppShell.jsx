import { Link, NavLink, useNavigate } from 'react-router-dom'
import { getSession, clearSession } from '../services/auth.js'
import { normRole, ROLE_LABELS } from '../services/labels.js'

const NAV = {
  ADMIN: [['/admin', 'Yêu cầu đăng ký'], ['/admin/users', 'Quản lý tài khoản']],
  MANAGER: [['/manager/classes', 'Quản lý lớp'], ['/manager/children', 'Quản lý trẻ']],
}

// Khung chung cho trang quản trị: tiêu đề, menu theo vai trò, đổi mật khẩu, đăng xuất
export default function AppShell({ title, sub, children }) {
  const navigate = useNavigate()
  const session = getSession()
  const role = normRole(session?.user.role)
  return (
    <div className="admin">
      <header className="admin-head">
        <div>
          <h1>{title}</h1>
          <p className="sub">{sub ?? `${ROLE_LABELS[role] ?? role}: ${session?.user.email}`}</p>
        </div>
        <div className="actions">
          <Link className="btn btn-sm btn-ghost btn-link-inline" to="/change-password">Đổi mật khẩu</Link>
          <button className="btn btn-sm" onClick={() => { clearSession(); navigate('/login') }}>Đăng xuất</button>
        </div>
      </header>
      <nav className="subnav" aria-label="Chức năng">
        {(NAV[role] || []).map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/admin'}>{label}</NavLink>
        ))}
      </nav>
      {children}
    </div>
  )
}
