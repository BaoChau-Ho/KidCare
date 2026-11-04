import { Link, NavLink, useNavigate } from 'react-router-dom'
import { getSession, clearSession } from '../services/auth.js'
import { normRole, ROLE_LABELS } from '../services/labels.js'
import NotificationBell from './NotificationBell.jsx'

const NAV = {
  ADMIN: [['/admin', 'Yêu cầu đăng ký'], ['/admin/users', 'Quản lý tài khoản']],
  MANAGER: [['/manager/classes', 'Quản lý lớp'], ['/manager/children', 'Quản lý trẻ'], ['/manager/reports', 'Báo cáo']],
  TEACHER: [['/teacher', 'Điểm danh'], ['/teacher/leave', 'Đơn xin nghỉ'], ['/teacher/activities', 'Hoạt động'], ['/teacher/pickups', 'Đón trẻ'], ['/teacher/notify', 'Gửi thông báo']],
  PARENT: [['/parent', 'Con của tôi'], ['/parent/leave', 'Xin nghỉ học'], ['/parent/pickups', 'Đăng ký đón trẻ']],
  MEDICAL_STAFF: [['/medical', 'Hồ sơ sức khỏe']],
}
const HOMES = ['/admin', '/teacher', '/parent', '/medical'] // trang chủ của vai trò: chỉ sáng khi đúng đường dẫn

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
          <NotificationBell />
          <Link className="btn btn-sm btn-ghost btn-link-inline" to="/change-password">Đổi mật khẩu</Link>
          <button className="btn btn-sm" onClick={() => { clearSession(); navigate('/login') }}>Đăng xuất</button>
        </div>
      </header>
      <nav className="subnav" aria-label="Chức năng">
        {(NAV[role] || []).map(([to, label]) => (
          <NavLink key={to} to={to} end={HOMES.includes(to)}>{label}</NavLink>
        ))}
      </nav>
      {children}
    </div>
  )
}
