import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getUnreadCount } from '../services/notifications.js'

// Chuông thông báo: hỏi lại server mỗi 30 giây (polling) là đủ cho MVP
export default function NotificationBell() {
  const [count, setCount] = useState(0)
  const refresh = useCallback(() => getUnreadCount().then((r) => setCount(r.unreadCount), () => {}), [])
  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 30000)
    window.addEventListener('notifications:changed', refresh)
    return () => { clearInterval(t); window.removeEventListener('notifications:changed', refresh) }
  }, [refresh])
  return (
    <Link className="bell" to="/notifications" aria-label={count ? `Thông báo, ${count} chưa đọc` : 'Thông báo'}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6zM10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {count > 0 && <span className="bell-count">{count > 99 ? '99+' : count}</span>}
    </Link>
  )
}
