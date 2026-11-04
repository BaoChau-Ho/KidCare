import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell.jsx'
import ChildPills from '../../components/ChildPills.jsx'
import Tabs from '../../components/Tabs.jsx'
import Pagination from '../../components/Pagination.jsx'
import HealthSummaryView from '../../components/HealthSummaryView.jsx'
import useFetch from '../../hooks/useFetch.js'
import { listChildren } from '../../services/children.js'
import { getChildToday, listChildAttendance } from '../../services/attendance.js'
import { getHealthSummary } from '../../services/health.js'
import { listChildActivities } from '../../services/activities.js'
import { ATTENDANCE_STATUS, fmtDate, fmtTime } from '../../services/labels.js'
import { todayStr, addDays } from '../../services/dates.js'

const TABS = [{ key: 'attendance', label: 'Điểm danh' }, { key: 'health', label: 'Sức khỏe' }, { key: 'activities', label: 'Hoạt động' }]

// UC-07 — Phụ huynh theo dõi tình hình của con: hôm nay, lịch sử điểm danh, sức khỏe, hoạt động
export default function ParentDashboard() {
  const { data, loading, error, reload } = useFetch(() => listChildren({ limit: 50 }), [])
  const kids = data?.items ?? []
  const [sel, setSel] = useState('')
  const [tab, setTab] = useState('attendance')
  const child = kids.find((c) => c.id === sel) ?? kids[0]

  return (
    <AppShell title="Con của tôi">
      {error && <div className="alert spaced" role="alert">{error} <button className="link-btn" onClick={reload}>Thử lại</button></div>}
      {loading && !data && <p className="muted spaced">Đang tải...</p>}

      {data && kids.length === 0 && (
        <div className="panel spaced empty-panel">
          <h2 className="panel-title">Chưa có trẻ nào được liên kết</h2>
          <p>Tài khoản của bạn chưa được liên kết với hồ sơ của bé. Vui lòng liên hệ nhà trường để được liên kết.</p>
        </div>
      )}

      {child && (
        <>
          <ChildPills children={kids} value={child.id} onChange={(id) => { setSel(id) }} />
          <TodayCard child={child} />
          <Tabs tabs={TABS} value={tab} onChange={setTab} label="Thông tin của bé" />
          {tab === 'attendance' && <AttendanceTab key={child.id} childId={child.id} />}
          {tab === 'health' && <HealthTab key={child.id} childId={child.id} />}
          {tab === 'activities' && <ActivitiesTab key={child.id} childId={child.id} />}
        </>
      )}
    </AppShell>
  )
}

function TodayCard({ child }) {
  const { data, loading, error } = useFetch(() => getChildToday(child.id), [child.id])
  return (
    <section className="panel today" aria-live="polite">
      <div>
        <h2 className="panel-title">{child.name}</h2>
        <p className="muted">{child.className ?? 'Chưa xếp lớp'} &middot; Hôm nay {fmtDate(todayStr())}</p>
      </div>
      {loading && !data && <p className="muted">Đang tải...</p>}
      {error && <div className="alert" role="alert">{error}</div>}
      {data && (
        <div className="today-status">
          <span className={`badge big ${data.status.toLowerCase()}`}>
            {data.status === 'ABSENT' && data.onLeave && !data.checkInTime ? 'Nghỉ có phép' : data.status === 'NOT_CHECKED_IN' ? 'Chưa đến lớp' : ATTENDANCE_STATUS[data.status]}
          </span>
          {data.checkInTime && <span>Đến lúc <b>{fmtTime(data.checkInTime)}</b></span>}
          {data.checkOutTime && <span>Về lúc <b>{fmtTime(data.checkOutTime)}</b></span>}
          {data.earlyLeave && <span className="badge late">Về sớm</span>}
        </div>
      )}
      <Link className="btn btn-sm btn-ghost btn-link-inline" to={`/parent/leave?childId=${child.id}`}>Gửi đơn xin nghỉ</Link>
    </section>
  )
}

function AttendanceTab({ childId }) {
  const [range, setRange] = useState({ from: addDays(todayStr(), -30), to: todayStr() })
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useFetch(() => listChildAttendance(childId, { ...range, page, limit: 10 }), [childId, range.from, range.to, page])
  const set = (k) => (e) => { setRange((r) => ({ ...r, [k]: e.target.value })); setPage(1) }
  return (
    <div>
      <div className="toolbar tight">
        <div className="field-inline"><label htmlFor="from">Từ ngày</label><input id="from" type="date" max={range.to} value={range.from} onChange={set('from')} /></div>
        <div className="field-inline"><label htmlFor="to">Đến ngày</label><input id="to" type="date" min={range.from} max={todayStr()} value={range.to} onChange={set('to')} /></div>
      </div>
      {error && <div className="alert spaced" role="alert">{error} <button className="link-btn" onClick={reload}>Thử lại</button></div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Ngày</th><th>Trạng thái</th><th>Giờ đến</th><th>Giờ về</th></tr></thead>
          <tbody>
            {loading && !data && <tr><td colSpan="4" className="empty">Đang tải...</td></tr>}
            {data?.items.length === 0 && <tr><td colSpan="4" className="empty">Không có dữ liệu điểm danh trong khoảng ngày này.</td></tr>}
            {data?.items.map((a) => (
              <tr key={a.id}>
                <td>{fmtDate(a.date)}</td>
                <td><span className={`badge ${a.status.toLowerCase()}`}>{ATTENDANCE_STATUS[a.status]}</span>{a.earlyLeave && <> <span className="badge late">Về sớm</span></>}</td>
                <td>{fmtTime(a.checkInTime)}</td>
                <td>{fmtTime(a.checkOutTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pageInfo={data?.pageInfo} onChange={setPage} />
    </div>
  )
}

function HealthTab({ childId }) {
  const { data, loading, error, reload } = useFetch(() => getHealthSummary(childId), [childId])
  return (
    <div className="panel">
      {loading && !data && <p className="muted">Đang tải...</p>}
      {error && <div className="alert" role="alert">{error} <button className="link-btn" onClick={reload}>Thử lại</button></div>}
      {data && <HealthSummaryView summary={data} />}
      <p className="hint spaced">Bạn chỉ xem được phần thông tin dành cho phụ huynh. Chẩn đoán chi tiết do nhân viên y tế lưu giữ; hãy liên hệ nhà trường nếu cần biết thêm.</p>
    </div>
  )
}

function ActivitiesTab({ childId }) {
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useFetch(() => listChildActivities(childId, { page, limit: 5 }), [childId, page])
  return (
    <div>
      {error && <div className="alert" role="alert">{error} <button className="link-btn" onClick={reload}>Thử lại</button></div>}
      {loading && !data && <p className="muted">Đang tải...</p>}
      {data?.items.length === 0 && <div className="panel empty-panel">Bé chưa tham gia hoạt động nào được ghi nhận.</div>}
      <div className="timeline">
        {data?.items.map((a) => (
          <article key={a.id} className="card">
            <header><h3>{a.title}</h3><span className="muted">{a.className} &middot; {fmtDate(a.date)}</span></header>
            {a.description && <p>{a.description}</p>}
            {a.images.length > 0 && <div className="thumbs">{a.images.map((im) => <img key={im.id} src={im.url} alt={`Ảnh hoạt động ${a.title}`} loading="lazy" />)}</div>}
          </article>
        ))}
      </div>
      <Pagination pageInfo={data?.pageInfo} onChange={setPage} />
    </div>
  )
}
