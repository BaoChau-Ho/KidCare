import { SEVERITY, fmtDate, fmtDT, fmtNum } from '../services/labels.js'

// Hiển thị bản tóm tắt sức khỏe do server đã lọc theo vai trò (summary.view: FULL | PARENT | ALERT_ONLY)
export default function HealthSummaryView({ summary }) {
  const { latestRecord: r, allergies, medicalConditions, vaccinations, upcomingVaccinations, visits } = summary
  const hasAnything = r || allergies.length || medicalConditions.length || vaccinations.length || visits.length
  return (
    <div className="health">
      {!hasAnything && <p className="muted">Chưa có dữ liệu sức khỏe cho bé.</p>}

      {r && (
        <section>
          <h3 className="panel-title">Số đo gần nhất <span className="muted">({fmtDT(r.recordedAt)})</span></h3>
          <div className="stats">
            <div className="stat"><b>{fmtNum(r.height, 'cm')}</b><span>Chiều cao</span></div>
            <div className="stat"><b>{fmtNum(r.weight, 'kg')}</b><span>Cân nặng</span></div>
            <div className={`stat ${r.temperature >= 37.5 ? 'stat-warn' : ''}`}><b>{fmtNum(r.temperature, '°C')}</b><span>Nhiệt độ</span></div>
          </div>
        </section>
      )}

      {(allergies.length > 0 || medicalConditions.length > 0) && (
        <section>
          <h3 className="panel-title">Dị ứng và bệnh nền</h3>
          <div className="chips">
            {allergies.map((a) => <span key={a.id} className={`chip chip-warn sev-${(a.severity || '').toLowerCase()}`}>{'\u26A0'} {a.allergen} ({SEVERITY[a.severity]})</span>)}
            {medicalConditions.map((m) => <span key={m.id} className="chip">{m.name}</span>)}
          </div>
        </section>
      )}

      {upcomingVaccinations?.length > 0 && (
        <div className="notice" role="status">
          Sắp đến hạn tiêm: {upcomingVaccinations.map((v) => `${v.vaccineName} (${fmtDate(v.nextDueDate)})`).join('; ')}.
        </div>
      )}

      {vaccinations.length > 0 && (
        <section>
          <h3 className="panel-title">Tiêm chủng</h3>
          <div className="table-wrap flat">
            <table>
              <thead><tr><th>Vắc-xin</th><th>Mũi</th><th>Ngày tiêm</th><th>Hẹn mũi tiếp</th></tr></thead>
              <tbody>
                {vaccinations.map((v) => <tr key={v.id}><td>{v.vaccineName}</td><td>{v.doseNumber}</td><td>{fmtDate(v.vaccinatedAt)}</td><td>{v.nextDueDate ? fmtDate(v.nextDueDate) : '\u2014'}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {visits.length > 0 && (
        <section>
          <h3 className="panel-title">Các lần khám gần đây</h3>
          <ul className="plain-list">
            {visits.map((v) => (
              <li key={v.id}>
                <strong>{fmtDT(v.visitedAt)}</strong>
                {v.symptoms && <div>Triệu chứng: {v.symptoms}</div>}
                {v.conclusion && <div>Kết luận: {v.conclusion}</div>}
                {v.medications?.length > 0 && <div className="muted">Thuốc: {v.medications.map((m) => `${m.name} ${m.dosage}, ${m.schedule}`).join('; ')}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
