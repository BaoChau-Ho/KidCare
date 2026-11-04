import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import SetPassword from './pages/SetPassword.jsx'
import AdminRequests from './pages/AdminRequests.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import { ROLES, getSession, clearSession } from './services/auth.js'

// Temporary home page per role (replace with real pages later)
function Home({ role }) {
  const navigate = useNavigate()
  const session = getSession()
  if (!session || session.user.role !== role) return <Navigate to="/login" replace />
  return (
    <main className="stub">
      <h1>{ROLES[role].label} home</h1>
      <p>Welcome, {session.user.email}</p>
      <p><Link to="/change-password">Change password</Link></p>
      <button className="btn" onClick={() => { clearSession(); navigate('/login') }}>Sign out</button>
    </main>
  )
}

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
      {Object.entries(ROLES).filter(([role]) => role !== 'admin').map(([role, { home }]) => (
        <Route key={role} path={home} element={<Home role={role} />} />
      ))}
    </Routes>
  )
}