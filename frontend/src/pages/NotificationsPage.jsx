import { useState } from 'react'
import AppShell from '../components/AppShell.jsx'
import Select from '../components/Select.jsx'
import Pagination from '../components/Pagination.jsx'
import useFetch from '../hooks/useFetch.js'
import { listNotifications, markRead, markAllRead } from '../services/notifications.js'
import { NOTI_TYPE, fmtDateTime } from '../services/labels.js'

// UC-14 — Hộp thư thông báo của chính mình: phân trang, lọc chưa đọc, đánh dấu đã đọc
export default function NotificationsPage() {
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useFetch(() => listNotifications({ unread: filter === 'unread' ? 'true' : '', page, limit: 10 }), [filter, page])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const bump = () => window.dispatchEvent(new Event('notifications:changed')) // cập nhật số trên chuông

  const open = async (n) => {
    if (n.isRead) return
    setErr('')
    try { await markRead(n.id); bump(); reload() } catch (e) { setErr(e.message) }
  }
  const readAll = async () => {
    setBusy(true); setErr('')
    try { await markAllRead(); bump(); reload() } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const unreadHere = data?.items.some((n) => !n.isRead)

  return (
    <AppShell title="Thông báo">
      <div className="toolbar">
        <Select aria-label="Lọc thông báo" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1) }}>
          <option value="all">Tất cả thông báo</option>
          <option value="unread">Chưa đọc</option>
        </Select>
        <button className="btn btn-sm btn-ghost toolbar-end" disabled={busy || !unreadHere} onClick={readAll}>Đánh dấu tất cả đã đọc</button>
      </div>
      {(error || err) && <div className="alert spaced" role="alert">{error || err} <button className="link-btn" onClick={reload}>Thử lại</button></div>}
      {loading && !data && <p className="muted spaced">Đang tải...</p>}
      {data?.items.length === 0 && <div className="panel spaced empty-panel">{filter === 'unread' ? 'Bạn không có thông báo chưa đọc.' : 'Bạn chưa có thông báo nào.'}</div>}

      <ul className="notif-list">
        {data?.items.map((n) => (
          <li key={n.id}>
            <button className={`notif ${n.isRead ? '' : 'unread'}`} onClick={() => open(n)} aria-label={`${n.isRead ? '' : 'Chưa đọc. '}${n.title}`}>
              <span className="dot" aria-hidden="true" />
              <span className="notif-body">
                <span className="notif-title">{n.title}</span>
                {n.content && <span className="notif-content">{n.content}</span>}
                <span className="muted">{NOTI_TYPE[n.type] ?? 'Thông báo'} &middot; {fmtDateTime(n.createdAt)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Pagination pageInfo={data?.pageInfo} onChange={setPage} />
    </AppShell>
  )
}
