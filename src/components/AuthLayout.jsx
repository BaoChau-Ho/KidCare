import { ROLES } from '../services/auth.js'

// Khung hai cột dùng chung cho các trang đăng ký / đặt mật khẩu
export default function AuthLayout({ children }) {
  return (
    <div className="login-page">
      <aside className="login-aside" aria-hidden="true">
        <div className="aside-inner">
          <h2>Một nơi chung cho cả trường</h2>
          <p>Phụ huynh, giáo viên, nhân viên y tế và quản lý cơ sở cùng theo dõi sức khỏe và hoạt động hằng ngày của trẻ.</p>
          <ul className="role-list">
            {Object.entries(ROLES).filter(([key]) => key !== 'admin').map(([key, r]) => (
              <li key={key}>{r.label}</li>
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
