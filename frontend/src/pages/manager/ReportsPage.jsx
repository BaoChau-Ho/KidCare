import { useState } from 'react'
import AppShell from '../../components/AppShell.jsx'
import Select from '../../components/Select.jsx'
import Tabs from '../../components/Tabs.jsx'
import useFetch from '../../hooks/useFetch.js'
import useMyClasses from '../../hooks/useMyClasses.js'
import { attendanceReport, classReport, healthReport } from '../../services/reports.js'
import { fmtDate } from '../../services/labels.js'
import { todayStr, addDays } from '../../services/dates.js'

const TABS = [{ key: 'attendance', label: 'Điểm danh' }, { key: 'classes', label: 'Lớp học' }, { key: 'health', label: 'Sức khỏe' }]
const pct = (v) => (v == null ? '\u2014' : `${(v * 100).toFixed(1).replace('.', ',')}%`) // API trả phân số 0..1

// UC-15 — Báo cáo cho quản lý: lọc theo lớp và khoảng ngày; chỉ hiển thị số liệu tổng hợp
export default function ReportsPage() {
  const { classes } = useMyClasses()
  const [tab, setTab] = useState('attendance')
  const [classId, setClassId] = useState('')
  const [range, setRange] = useState({ from: addDays(todayStr(), -29), to: todayStr() })
  const clientErr = range.from > range.to ? 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.' : ''
  const fn = { attendance: attendanceReport, classes: classReport, health: healthReport }[tab]
  const q = { from: range.from, to: range.to, ...(tab !== 'classes' ? { classId } : {}) }
  // Gắn nhãn tab vào dữ liệu để không vẽ nhầm dữ liệu của tab trước trong lúc tab mới đang tải
  const { data: raw, loading, error, reload } = useFetch(() => (clientErr ? Promise.resolve(null) : fn(q).then((d) => ({ ...d, _tab: tab }))), [tab, classId, range.from, range.to])
  const data = raw?._tab === tab ? raw : null
  const setR = (k) => (e) => e.target.value && setRange((r) => ({ ...r, [k]: e.target.value }))

  return (
    <AppShell title="Báo cáo">
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Loại báo cáo" />
      <div className="toolbar tight">
        {tab !== 'classes' && (
          <div className="field-inline">
            <label htmlFor="rc">Lớp</label>
            <Select id="rc" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Tất cả các lớp</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.academicYear})</option>)}
            </Select>
          </div>
        )}
        <div className="field-inline"><label htmlFor="rf">Từ ngày</label><input id="rf" type="date" max={range.to} value={range.from} onChange={setR('from')} /></div>
        <div className="field-inline"><label htmlFor="rt">Đến ngày</label><input id="rt" type="date" min={range.from} max={todayStr()} value={range.to} onChange={setR('to')} /></div>
        <div className="quick">
          {[7, 30, 90].map((d) => <button key={d} className="btn btn-sm btn-ghost" onClick={() => setRange({ from: addDays(todayStr(), -(d - 1)), to: todayStr() })}>{d} ngày</button>)}
        </div>
      </div>

      {(clientErr || error) && <div className="alert spaced" role="alert">{clientErr || error} {error && <button className="link-btn" onClick={reload}>Thử lại</button>}</div>}
      {loading && !data && !clientErr && <p className="muted spaced">Đang tổng hợp...</p>}
      {data && tab === 'attendance' && <AttendanceReport r={data} />}
      {data && tab === 'classes' && <ClassesReport r={data} />}
      {data && tab === 'health' && <HealthReport r={data} />}
      {data && <p className="muted spaced">Số liệu từ {fmtDate(data.from)} đến {fmtDate(data.to)}. Báo cáo chỉ gồm số liệu tổng hợp, không có dữ liệu sức khỏe của từng trẻ.</p>}
    </AppShell>
  )
}

function Stat({ label, value, warn }) { return <div className={`stat ${warn ? 'stat-warn' : ''}`}><b>{value}</b><span>{label}</span></div> }

function AttendanceReport({ r }) {
  const s = r.summary
  const max = Math.max(1, ...r.byDay.map((d) => d.total))
  if (s.total === 0) return <div className="panel spaced empty-panel">Không có dữ liệu điểm danh trong khoảng ngày này.</div>
  return (
    <>
      <div className="stats">
        <Stat label="Tỷ lệ chuyên cần" value={pct(s.attendanceRate)} />
        <Stat label="Có mặt" value={s.present} /><Stat label="Đi muộn" value={s.late} /><Stat label="Vắng" value={s.absent} /><Stat label="Về sớm" value={s.earlyLeave} />
      </div>

      <h2>Theo ngày</h2>
      <div className="panel">
        <div className="daybars" role="img" aria-label="Biểu đồ số lượt có mặt, muộn và vắng theo ngày">
          {r.byDay.map((d) => (
            <div key={d.date} className="daybar" title={`${fmtDate(d.date)}: có mặt ${d.present}, muộn ${d.late}, vắng ${d.absent}`}>
              <div className="stack" style={{ height: `${(d.total / max) * 100}%` }}>
                <i className="seg absent" style={{ flex: d.absent }} /><i className="seg late" style={{ flex: d.late }} /><i className="seg present" style={{ flex: d.present }} />
              </div>
              <span>{d.date.slice(8)}/{d.date.slice(5, 7)}</span>
            </div>
          ))}
        </div>
        <p className="legend"><i className="seg present" /> Có mặt <i className="seg late" /> Đi muộn <i className="seg absent" /> Vắng</p>
        <details>
          <summary>Xem dạng bảng</summary>
          <div className="table-wrap flat">
            <table>
              <thead><tr><th>Ngày</th><th>Có mặt</th><th>Muộn</th><th>Vắng</th><th>Chuyên cần</th></tr></thead>
              <tbody>{r.byDay.map((d) => <tr key={d.date}><td>{fmtDate(d.date)}</td><td>{d.present}</td><td>{d.late}</td><td>{d.absent}</td><td>{pct(d.attendanceRate)}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      </div>

      <h2>Theo lớp</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Lớp</th><th>Có mặt</th><th>Muộn</th><th>Vắng</th><th>Về sớm</th><th>Chuyên cần</th></tr></thead>
          <tbody>
            {r.byClass.map((c) => (
              <tr key={c.classId}>
                <td>{c.className}<br /><span className="muted">{c.academicYear}</span></td><td>{c.present}</td><td>{c.late}</td><td>{c.absent}</td><td>{c.earlyLeave}</td>
                <td><div className="meter"><i style={{ width: `${(c.attendanceRate ?? 0) * 100}%` }} /></div>{pct(c.attendanceRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ClassesReport({ r }) {
  if (r.items.length === 0) return <div className="panel spaced empty-panel">Chưa có lớp nào đang hoạt động.</div>
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Lớp</th><th>Số trẻ</th><th>Giáo viên</th><th>Hoạt động</th><th>Đơn nghỉ đã duyệt</th><th>Chuyên cần</th></tr></thead>
        <tbody>
          {r.items.map((c) => (
            <tr key={c.classId}><td>{c.className}<br /><span className="muted">{c.academicYear}</span></td><td>{c.childCount}</td><td>{c.teacherCount}</td><td>{c.activityCount}</td><td>{c.leaveCount}</td><td>{pct(c.attendanceRate)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HealthReport({ r }) {
  return (
    <>
      <div className="stats">
        <Stat label="Trẻ đang học" value={r.childCount} />
        <Stat label="Trẻ có dị ứng" value={r.childrenWithAllergy} warn={r.childrenWithAllergy > 0} />
        <Stat label="Trẻ có bệnh nền" value={r.childrenWithCondition} />
      </div>
      <div className="stats">
        <Stat label="Lượt đo trong kỳ" value={r.measurements} />
        <Stat label="Ca sốt (từ 37,5 °C)" value={r.feverCases} warn={r.feverCases > 0} />
        <Stat label="Mũi tiêm trong kỳ" value={r.vaccinationsGiven} />
        <Stat label="Sắp đến hạn tiêm (30 ngày)" value={r.vaccinationsDueSoon} />
        <Stat label="Lượt khám trong kỳ" value={r.medicalVisits} />
      </div>
    </>
  )
}
