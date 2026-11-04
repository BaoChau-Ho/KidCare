import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  ROLES,
  getSession,
  clearSession,
  listRequests,
  approveRequest,
  rejectRequest,
} from '../services/auth.js'

const mask = (id) => '\u2022'.repeat(8) + id.slice(-4)

export default function AdminRequests() {
  const navigate = useNavigate()
  const session = getSession()
  const isAdmin = session?.user?.role === 'admin'
  const [requests, setRequests] = useState([])
  const [busy, setBusy] = useState('')
  const [rejecting, setRejecting] = useState(null) // { id, reason }
  const [revealed, setRevealed] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    try {
      setRequests(await listRequests())
      setError('')
    } catch (err) {
      setError(err.message || 'Could not load registration requests.')
    }
  }, [])
  useEffect(() => {
    if (isAdmin) refresh()
  }, [isAdmin, refresh])

  if (!isAdmin) return <Navigate to="/login" replace />

  const approve = async (id) => {
    setBusy(id)
    setError('')
    setNotice('')
    try {
      const result = await approveRequest(id)
      setNotice(`${result.email} is approved and can sign in with the password chosen during registration.`)
      await refresh()
    } catch (err) {
      setError(err.message || 'Could not approve this request.')
    } finally {
      setBusy('')
    }
  }

  const reject = async () => {
    if (!rejecting?.reason.trim()) return
    const { id, reason } = rejecting
    setBusy(id)
    setError('')
    setNotice('')
    try {
      await rejectRequest(id, reason.trim())
      setRejecting(null)
      await refresh()
    } catch (err) {
      setError(err.message || 'Could not reject this request.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="admin">
      <header className="admin-head">
        <div>
          <h1>Registration requests</h1>
          <p className="sub">Signed in as {session.user.email}</p>
        </div>
        <div className="actions">
          <Link className="btn btn-sm btn-ghost btn-link-inline" to="/change-password">Change password</Link>
          <button className="btn btn-sm" onClick={() => { clearSession(); navigate('/login') }}>Sign out</button>
        </div>
      </header>

      {error && <div className="alert" role="alert">{error}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>National ID</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {requests.length === 0 && <tr><td colSpan="6" className="empty">No requests yet. Submit one from /register.</td></tr>}
            {requests.map((r) => (
              <tr key={r.id}>
                <td>{r.fullName}<br /><span className="muted">{r.phone}</span></td>
                <td>{r.email}</td>
                <td>{ROLES[r.role]?.label || r.role}</td>
                <td>
                  {revealed[r.id] ? r.nationalId : mask(r.nationalId)}{' '}
                  <button className="link-btn" onClick={() => setRevealed((v) => ({ ...v, [r.id]: !v[r.id] }))}>
                    {revealed[r.id] ? 'Hide' : 'Show'}
                  </button>
                </td>
                <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                <td>
                  {r.status === 'pending' && rejecting?.id !== r.id && (
                    <div className="actions">
                      <button className="btn btn-sm" disabled={busy === r.id} onClick={() => approve(r.id)}>Approve</button>
                      <button className="btn btn-sm btn-danger" onClick={() => setRejecting({ id: r.id, reason: '' })}>Reject</button>
                    </div>
                  )}
                  {rejecting?.id === r.id && (
                    <div className="reject-box">
                      <input placeholder="Reason for rejecting this request" value={rejecting.reason}
                        onChange={(e) => setRejecting({ ...rejecting, reason: e.target.value })} />
                      <div className="actions">
                        <button className="btn btn-sm btn-danger" disabled={!rejecting.reason.trim() || busy === r.id} onClick={reject}>Confirm reject</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setRejecting(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                  {r.status === 'rejected' && <span className="muted">{r.rejectionReason}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
