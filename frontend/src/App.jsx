import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import SetPassword from './pages/SetPassword.jsx'
import AdminRequests from './pages/AdminRequests.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import RoleGuard from './components/RoleGuard.jsx'
import UsersPage from './pages/admin/UsersPage.jsx'
import ClassesPage from './pages/classes/ClassesPage.jsx'
import ChildrenPage from './pages/children/ChildrenPage.jsx'
import ChildDetailPage from './pages/children/ChildDetailPage.jsx'
import { ROLES, getSession, clearSession } from './services/auth.js'
import { normRole } from './services/labels.js'

// Trang chủ tạm cho từng vai trò (sẽ thay bằng trang thật sau)
function Home({ role }) {
  const navigate = useNavigate()
  const session = getSession()
  if (!session || session.user.role !== role) return <Navigate to="/login" replace />
  return (
    <main className="stub">
      <h1>Trang chủ {ROLES[role].label}</h1>
      <p>Xin chào, {session.user.email}</p>
      <p><Link to="/change-password">Đổi mật khẩu</Link></p>
      <button className="btn" onClick={() => { clearSession(); navigate('/login') }}>Đăng xuất</button>
    </main>
  )
}

// Các đường dẫn đã có trang thật; không đăng ký trang chủ tạm trùng với chúng
const MANAGED = ['/manager/classes', '/manager/children']
const isManagedPath = (home) => MANAGED.includes(home)

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<SetPassword mode="reset" />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="/admin" element={<AdminRequests />} />

      {/* UC-03: Admin quản lý tài khoản */}
      <Route path="/admin/users" element={<RoleGuard roles={['ADMIN']}><UsersPage /></RoleGuard>} />
      {/* UC-05 và UC-04: Quản lý cơ sở */}
      <Route path="/manager/classes" element={<RoleGuard roles={['MANAGER']}><ClassesPage /></RoleGuard>} />
      <Route path="/manager/children" element={<RoleGuard roles={['MANAGER']}><ChildrenPage /></RoleGuard>} />
      <Route path="/manager/children/:id" element={<RoleGuard roles={['MANAGER']}><ChildDetailPage /></RoleGuard>} />

      {Object.entries(ROLES).filter(([role]) => role !== 'admin' && !isManagedPath(ROLES[role].home)).map(([role, { home }]) => (
        <Route
          key={role} path={home}
          element={normRole(role) === 'MANAGER' ? <Navigate to="/manager/classes" replace /> : <Home role={role} />}
        />
      ))}
    </Routes>
  )
}