import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell.jsx'
import Select from '../components/Select.jsx'
import Pagination from '../components/Pagination.jsx'
import useFetch from '../hooks/useFetch.js'
import { listNotifications, markRead, markAllRead } from '../services/notifications.js'
import { NOTI_TYPE, fmtDateTime } from '../services/labels.js'
import { getSession, ROLES } from '../services/auth.js'

// UC-14 — Hộp thư thông báo của chính mình: phân trang, lọc chưa đọc, đánh dấu đã đọc
export default function NotificationsPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useFetch(() => listNotifications({ unread: filter === 'unread' ? 'true' : '', page, limit: 10 }), [filter, page])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const bump = () => window.dispatchEvent(new Event('notifications:changed')) // cập nhật số trên chuông

  const targetFor = (n) => {
    const role = getSession()?.user?.role?.toLowerCase()
    const id = encodeURIComponent(n.relatedId ?? '')
    const highlight = id ? `?highlightId=${id}` : ''
    switch (n.relatedType) {
      case 'leave':
      case 'leave_request':
        return role === 'parent' ? `/parent/leave${highlight}` : `/teacher/leave?status=&highlightId=${id}`
      case 'pickup':
      case 'pickup_request':
        return role === 'parent' ? `/parent/pickups${highlight}` : `/teacher/pickups${highlight}`
      case 'activity':
        return role === 'parent' ? `/parent?tab=activities&highlightId=${id}` : `/teacher/activities${highlight}`
      case 'child':
        if (role === 'parent') return `/parent?childId=${id}&tab=${n.type === 'ATTENDANCE' ? 'attendance' : 'health'}&highlightId=${id}`
        if (role === 'medical') return `/medical/children/${id}`
        if (role === 'manager') return `/manager/children/${id}`
        return `/teacher?highlightId=${id}`
      case 'attendance':
      case 'health':
        if (role === 'parent') return `/parent?childId=${id}&tab=${n.relatedType}&highlightId=${id}`
        if (role === 'medical') return `/medical/children/${id}?highlightId=${id}`
        return ROLES[role]?.home ?? '/'
      case 'class':
        if (role === 'manager') return `/manager/classes?highlightId=${id}`
        if (role === 'teacher') return `/teacher/activities?classId=${id}`
        return ROLES[role]?.home ?? '/'
      default:
        if (n.type === 'LEAVE') return role === 'parent' ? '/parent/leave' : '/teacher/leave'
        if (n.type === 'PICKUP') return role === 'parent' ? '/parent/pickups' : '/teacher/pickups'
        if (n.type === 'ACTIVITY') return role === 'parent' ? '/parent?tab=activities' : '/teacher/activities'
        if (n.type === 'ATTENDANCE') return role === 'parent' ? '/parent?tab=attendance' : ROLES[role]?.home ?? '/'
        if (n.type === 'HEALTH') return role === 'parent' ? '/parent?tab=health' : ROLES[role]?.home ?? '/'
        return ROLES[role]?.home ?? '/'
    }
  }

  const open = async (n) => {
    setErr('')
    try {
      if (!n.isRead) await markRead(n.id)
      bump()
      navigate(targetFor(n))
    } catch (e) { setErr(e.message) }
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
