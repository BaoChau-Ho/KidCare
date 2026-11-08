import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import AppShell from '../components/AppShell.jsx'
import { ROLES, getSession, listRequests, listOutbox, approveRequest, rejectRequest } from '../services/auth.js'
import { REQUEST_STATUS } from '../services/labels.js'

const mask = (id) => '\u2022'.repeat(8) + id.slice(-4)

export default function AdminRequests() {
  const session = getSession()
  const [requests, setRequests] = useState([])
  const [outbox, setOutbox] = useState([])
  const [busy, setBusy] = useState('')
  const [rejecting, setRejecting] = useState(null) // { id, reason }
  const [revealed, setRevealed] = useState({})

  const refresh = useCallback(async () => {
    setRequests(await listRequests())
    setOutbox(await listOutbox())
  }, [])
  useEffect(() => { refresh() }, [refresh])

  if (!session || session.user.role !== 'admin') return <Navigate to="/login" replace />

  const approve = async (id) => { setBusy(id); await approveRequest(id); setBusy(''); refresh() }
  const reject = async () => {
    if (!rejecting.reason.trim()) return
    setBusy(rejecting.id)
    await rejectRequest(rejecting.id, rejecting.reason.trim())
    setBusy(''); setRejecting(null); refresh()
  }

  return (
    <AppShell title="Yêu cầu đăng ký">
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>CCCD</th><th>Trạng thái</th><th>Thao tác</th></tr>
          </thead>
          <tbody>
            {requests.length === 0 && <tr><td colSpan="6" className="empty">Chưa có yêu cầu nào. Hãy gửi thử một yêu cầu từ trang /register.</td></tr>}
            {requests.map((r) => (
              <tr key={r.id}>
                <td>{r.fullName}<br /><span className="muted">{r.phone}</span></td>
                <td>{r.email}</td>
                <td>{ROLES[r.role].label}</td>
                <td>
                  {revealed[r.id] ? r.nationalId : mask(r.nationalId)}{' '}
                  <button className="link-btn" onClick={() => setRevealed((v) => ({ ...v, [r.id]: !v[r.id] }))}>
                    {revealed[r.id] ? 'Ẩn' : 'Hiện'}
                  </button>
                </td>
                <td><span className={`badge ${r.status}`}>{REQUEST_STATUS[r.status] ?? r.status}</span></td>
                <td>
                  {r.status === 'pending' && rejecting?.id !== r.id && (
                    <div className="actions">
                      <button className="btn btn-sm" disabled={busy === r.id} onClick={() => approve(r.id)}>Duyệt</button>
                      <button className="btn btn-sm btn-danger" onClick={() => setRejecting({ id: r.id, reason: '' })}>Từ chối</button>
                    </div>
                  )}
                  {rejecting?.id === r.id && (
                    <div className="reject-box">
                      <input placeholder="Lý do (gửi cho người dùng)" aria-label="Lý do từ chối" value={rejecting.reason}
                        onChange={(e) => setRejecting({ ...rejecting, reason: e.target.value })} />
                      <div className="actions">
                        <button className="btn btn-sm btn-danger" disabled={!rejecting.reason.trim() || busy === r.id} onClick={reject}>Xác nhận từ chối</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setRejecting(null)}>Hủy</button>
                      </div>
                    </div>
                  )}
                  {r.status === 'rejected' && <span className="muted">{r.reason}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Hộp thư email <span className="muted">(mô phỏng, thay cho email thật)</span></h2>
      {outbox.length === 0 && <p className="muted">Chưa có email nào được gửi.</p>}
      <ul className="outbox">
        {outbox.map((m) => (
          <li key={m.id}>
            <strong>{m.subject}</strong> gửi đến {m.to}
            <div className="muted">{m.body}</div>
            {m.link && <a href={m.link} target="_blank" rel="noreferrer">Mở liên kết</a>}
          </li>
        ))}
      </ul>
    </AppShell>
  )
}
