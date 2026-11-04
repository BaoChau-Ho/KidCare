import { Link, Navigate } from 'react-router-dom'
import { getSession } from '../services/auth.js'
import { normRole } from '../services/labels.js'

// Chưa đăng nhập -> /login. Sai vai trò -> thông báo không đủ quyền (E-AUTH).
// Lưu ý: backend vẫn phải kiểm tra quyền; guard này chỉ để giao diện không dẫn nhầm trang.
export default function RoleGuard({ roles, children }) {
  const session = getSession()
  if (!session) return <Navigate to="/login" replace />
  if (!roles.includes(normRole(session.user.role))) {
    return (
      <main className="stub">
        <h1>Không đủ quyền</h1>
        <p>Tài khoản của bạn không được truy cập trang này.</p>
        <p><Link to="/login">Về trang đăng nhập</Link></p>
      </main>
    )
  }
  return children
}
