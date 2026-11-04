import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell.jsx'
import Select from '../../components/Select.jsx'
import Pagination from '../../components/Pagination.jsx'
import useFetch from '../../hooks/useFetch.js'
import useDebounce from '../../hooks/useDebounce.js'
import { listChildren } from '../../services/children.js'
import { listClasses } from '../../services/classes.js'
import { getClassAlerts } from '../../services/health.js'
import { CHILD_STATUS, SEVERITY } from '../../services/labels.js'

// UC-09 — Nhân viên y tế: tìm trẻ để mở hồ sơ sức khỏe, và xem cảnh báo theo lớp
export default function HealthPage() {
  const [filters, setFilters] = useState({ query: '', classId: '' })
  const [page, setPage] = useState(1)
  const query = useDebounce(filters.query)
  const { data, loading, error, reload } = useFetch(() => listChildren({ query: query.trim(), classId: filters.classId, status: 'ACTIVE', page, limit: 10 }), [query, filters.classId, page])
  const { data: classPage } = useFetch(() => listClasses({ status: 'ACTIVE', limit: 100 }), [])
  const classes = classPage?.items ?? []
  const [alertClass, setAlertClass] = useState('')
  const aid = alertClass || classes[0]?.id || ''
  const { data: alerts, loading: loadingAlerts } = useFetch(() => (aid ? getClassAlerts(aid) : Promise.resolve(null)), [aid])

  return (
    <AppShell title="Hồ sơ sức khỏe">
      <div className="toolbar">
        <div className="grow">
          <input type="search" placeholder="Tìm trẻ theo tên" aria-label="Tìm trẻ" value={filters.query} onChange={(e) => { setFilters((f) => ({ ...f, query: e.target.value })); setPage(1) }} />
        </div>
        <Select aria-label="Lọc theo lớp" value={filters.classId} onChange={(e) => { setFilters((f) => ({ ...f, classId: e.target.value })); setPage(1) }}>
          <option value="">Mọi lớp</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.academicYear})</option>)}
        </Select>
      </div>
      {error && <div className="alert spaced" role="alert">{error} <button className="link-btn" onClick={reload}>Thử lại</button></div>}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Họ tên</th><th>Lớp</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {loading && !data && <tr><td colSpan="4" className="empty">Đang tải...</td></tr>}
            {data?.items.length === 0 && <tr><td colSpan="4" className="empty">Không tìm thấy trẻ nào.</td></tr>}
            {data?.items.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.className ?? <span className="muted">Chưa xếp lớp</span>}</td>
                <td><span className={`badge ${c.status.toLowerCase()}`}>{CHILD_STATUS[c.status]}</span></td>
                <td><Link className="btn btn-sm btn-ghost btn-link-inline" to={`/medical/children/${c.id}`}>Mở hồ sơ</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pageInfo={data?.pageInfo} onChange={setPage} />

      <h2>Cảnh báo sức khỏe theo lớp</h2>
      <div className="toolbar tight">
        <Select aria-label="Chọn lớp xem cảnh báo" value={aid} onChange={(e) => setAlertClass(e.target.value)} disabled={classes.length === 0}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.academicYear})</option>)}
        </Select>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Trẻ</th><th>Loại</th><th>Nội dung</th><th>Mức độ</th></tr></thead>
          <tbody>
            {loadingAlerts && !alerts && <tr><td colSpan="4" className="empty">Đang tải...</td></tr>}
            {alerts?.length === 0 && <tr><td colSpan="4" className="empty">Lớp này chưa có cảnh báo nào.</td></tr>}
            {alerts?.map((a, i) => (
              <tr key={i}>
                <td><Link to={`/medical/children/${a.childId}`}>{a.childName}</Link></td>
                <td>{a.kind === 'ALLERGY' ? 'Dị ứng' : 'Bệnh nền'}</td>
                <td>{a.allergen}</td>
                <td>{a.severity ? <span className={`badge sev-${a.severity.toLowerCase()}`}>{SEVERITY[a.severity]}</span> : '\u2014'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  )
}
