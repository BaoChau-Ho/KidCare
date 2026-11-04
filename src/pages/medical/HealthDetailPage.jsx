import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell.jsx'
import Field from '../../components/Field.jsx'
import Select from '../../components/Select.jsx'
import Modal from '../../components/Modal.jsx'
import Tabs from '../../components/Tabs.jsx'
import Pagination from '../../components/Pagination.jsx'
import HealthSummaryView from '../../components/HealthSummaryView.jsx'
import useFetch from '../../hooks/useFetch.js'
import { getChild } from '../../services/children.js'
import * as H from '../../services/health.js'
import { SEVERITY, fmtDate, fmtDT, fmtNum } from '../../services/labels.js'
import { todayStr, nowTime, localIso } from '../../services/dates.js'

const TABS = [
  { key: 'overview', label: 'Tổng quan' }, { key: 'records', label: 'Chỉ số' }, { key: 'conditions', label: 'Dị ứng và bệnh nền' },
  { key: 'vaccines', label: 'Tiêm chủng' }, { key: 'visits', label: 'Khám và thuốc' },
]
const num = (s) => (String(s).trim() === '' ? undefined : String(s).replace(',', '.'))
const a11yOf = (errors) => (k) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${k}-err` : undefined })

// Hộp thoại biểu mẫu dùng chung cho mọi thao tác ghi: lỗi theo trường hiện ngay dưới ô, lỗi khác hiện ở đầu hộp thoại
function FormModal({ title, submitLabel, onClose, onDone, validate, send, children, setErrors }) {
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setFormError('')
    const errs = validate?.() ?? {}
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try { await send(); onDone() }
    catch (err) { if (err.field) setErrors({ [err.field]: err.message }); else setFormError(err.message); setBusy(false) }
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {formError && <div className="alert" role="alert">{formError}</div>}
        {children}
        <div className="modal-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} disabled={busy}>Hủy</button>
          <button type="submit" className="btn btn-sm" disabled={busy}>{busy ? 'Đang lưu...' : submitLabel}</button>
        </div>
      </form>
    </Modal>
  )
}

// UC-09 — Hồ sơ sức khỏe của một trẻ (chỉ nhân viên y tế được ghi)
export default function HealthDetailPage() {
  const { id } = useParams()
  const { data: child, error } = useFetch(() => getChild(id), [id])
  const [tab, setTab] = useState('overview')
  const [flash, setFlash] = useState('')
  const ok = (m) => setFlash(m)

  return (
    <AppShell title={child?.name ?? 'Hồ sơ sức khỏe'} sub={child ? `Hồ sơ sức khỏe${child.className ? `, ${child.className}` : ''}` : undefined}>
      <p className="back-link"><Link to="/medical">Quay lại danh sách</Link></p>
      {error && !child && <div className="alert" role="alert">{error}</div>}
      {child && (
        <>
          <Tabs tabs={TABS} value={tab} onChange={(t) => { setTab(t); setFlash('') }} label="Hồ sơ sức khỏe" />
          {flash && <div className="notice" role="status">{flash}</div>}
          {tab === 'overview' && <OverviewTab childId={id} />}
          {tab === 'records' && <RecordsTab childId={id} onOk={ok} />}
          {tab === 'conditions' && <ConditionsTab childId={id} onOk={ok} />}
          {tab === 'vaccines' && <VaccinesTab childId={id} onOk={ok} />}
          {tab === 'visits' && <VisitsTab childId={id} onOk={ok} />}
        </>
      )}
    </AppShell>
  )
}

function OverviewTab({ childId }) {
  const { data, loading, error } = useFetch(() => H.getHealthSummary(childId), [childId])
  return (
    <div className="panel">
      {loading && !data && <p className="muted">Đang tải...</p>}
      {error && <div className="alert" role="alert">{error}</div>}
      {data?.abnormal?.length > 0 && <div className="alert" role="alert">Số đo gần nhất có chỉ số bất thường (nhiệt độ). Hãy theo dõi bé.</div>}
      {data && <HealthSummaryView summary={data} />}
    </div>
  )
}

/* ---------- Chỉ số ---------- */
function RecordsTab({ childId, onOk }) {
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useFetch(() => H.listHealthRecords(childId, { page, limit: 8 }), [childId, page])
  const [dialog, setDialog] = useState(null)
  return (
    <div>
      <div className="toolbar tight"><button className="btn btn-sm toolbar-end" onClick={() => setDialog({})}>Thêm số đo</button></div>
      {error && <div className="alert spaced" role="alert">{error}</div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Thời điểm</th><th>Cao</th><th>Nặng</th><th>Nhiệt độ</th><th>Ghi chú</th><th>Người ghi</th><th></th></tr></thead>
          <tbody>
            {loading && !data && <tr><td colSpan="7" className="empty">Đang tải...</td></tr>}
            {data?.items.length === 0 && <tr><td colSpan="7" className="empty">Chưa có số đo nào.</td></tr>}
            {data?.items.map((r) => (
              <tr key={r.id}>
                <td>{fmtDT(r.recordedAt)}</td><td>{fmtNum(r.height, 'cm')}</td><td>{fmtNum(r.weight, 'kg')}</td>
                <td>{fmtNum(r.temperature, '°C')} {r.abnormal?.length > 0 && <span className="badge absent">Bất thường</span>}</td>
                <td className="wrap">{r.note ?? '\u2014'}</td><td>{r.recordedByName}</td>
                <td><button className="btn btn-sm btn-ghost" onClick={() => setDialog({ record: r })}>Sửa</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pageInfo={data?.pageInfo} onChange={setPage} />
      {dialog && <RecordModal childId={childId} record={dialog.record} onClose={() => setDialog(null)} onDone={(m) => { setDialog(null); onOk(m); reload() }} />}
    </div>
  )
}
function RecordModal({ childId, record, onClose, onDone }) {
  const [f, setF] = useState({ height: record?.height ?? '', weight: record?.weight ?? '', temperature: record?.temperature ?? '', note: record?.note ?? '' })
  const [errors, setErrors] = useState({})
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const a11y = a11yOf(errors)
  const R = { height: [30, 150, 'Chiều cao', 'cm'], weight: [2, 50, 'Cân nặng', 'kg'], temperature: [34, 42, 'Nhiệt độ', '°C'] }
  const validate = () => {
    const errs = {}
    let any = false
    for (const [k, [min, max, label, unit]] of Object.entries(R)) {
      const v = num(f[k]); if (v === undefined) continue
      any = true
      const n = Number(v)
      if (Number.isNaN(n) || n < min || n > max) errs[k] = `${label} phải trong khoảng ${min} đến ${max} ${unit}`
    }
    if (!any) errs.height = 'Nhập ít nhất một chỉ số'
    return errs
  }
  const body = () => ({ height: num(f.height), weight: num(f.weight), temperature: num(f.temperature), note: f.note })
  return (
    <FormModal title={record ? 'Sửa số đo' : 'Thêm số đo'} submitLabel="Lưu" onClose={onClose} validate={validate} errors={errors} setErrors={setErrors}
      send={() => (record ? H.updateHealthRecord(record.id, body()) : H.createHealthRecord(childId, body()))}
      onDone={() => onDone(record ? 'Đã cập nhật số đo.' : 'Đã ghi số đo.')}>
      <div className="form-grid">
        <Field id="height" label="Chiều cao (cm)" error={errors.height}><input id="height" inputMode="decimal" value={f.height} onChange={set('height')} {...a11y('height')} /></Field>
        <Field id="weight" label="Cân nặng (kg)" error={errors.weight}><input id="weight" inputMode="decimal" value={f.weight} onChange={set('weight')} {...a11y('weight')} /></Field>
        <Field id="temperature" label="Nhiệt độ (°C)" error={errors.temperature} className="full" hint="Từ 37,5 °C trở lên sẽ được đánh dấu bất thường và báo cho phụ huynh.">
          <input id="temperature" inputMode="decimal" value={f.temperature} onChange={set('temperature')} {...a11y('temperature')} />
        </Field>
      </div>
      <Field id="note" label="Ghi chú (không bắt buộc)" error={errors.note}><textarea id="note" rows="3" value={f.note} onChange={set('note')} maxLength={2000} /></Field>
      {record && <p className="hint">Mọi thay đổi được ghi vào nhật ký (giá trị trước và sau); nội dung ghi chú không được ghi vào nhật ký.</p>}
    </FormModal>
  )
}

/* ---------- Dị ứng và bệnh nền ---------- */
function ConditionsTab({ childId, onOk }) {
  const al = useFetch(() => H.listAllergies(childId), [childId])
  const co = useFetch(() => H.listConditions(childId), [childId])
  const [dialog, setDialog] = useState(null) // 'allergy' | 'condition'
  const [err, setErr] = useState('')
  const toggle = async (fn, item, label) => {
    setErr('')
    try { await fn(item.id, { active: !item.active }); onOk(item.active ? `Đã ngừng theo dõi ${label}.` : `Đã theo dõi lại ${label}.`); al.reload(); co.reload() } catch (e) { setErr(e.message) }
  }
  const done = (m) => { setDialog(null); onOk(m); al.reload(); co.reload() }
  return (
    <div>
      {err && <div className="alert" role="alert">{err}</div>}
      <div className="toolbar tight">
        <button className="btn btn-sm toolbar-end" onClick={() => setDialog('allergy')}>Thêm dị ứng</button>
        <button className="btn btn-sm" onClick={() => setDialog('condition')}>Thêm bệnh nền</button>
      </div>
      <h2>Dị ứng</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Tác nhân</th><th>Mức độ</th><th>Ghi chú</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {al.data?.items.length === 0 && <tr><td colSpan="5" className="empty">Chưa ghi nhận dị ứng nào.</td></tr>}
            {al.data?.items.map((a) => (
              <tr key={a.id} className={a.active ? '' : 'row-off'}>
                <td>{a.allergen}</td><td><span className={`badge sev-${a.severity.toLowerCase()}`}>{SEVERITY[a.severity]}</span></td>
                <td className="wrap">{a.note ?? '\u2014'}</td><td>{a.active ? 'Đang theo dõi' : 'Ngừng theo dõi'}</td>
                <td><button className="btn btn-sm btn-ghost" onClick={() => toggle(H.updateAllergy, a, a.allergen)}>{a.active ? 'Ngừng theo dõi' : 'Theo dõi lại'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Bệnh nền</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Tên bệnh</th><th>Ghi chú</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {co.data?.items.length === 0 && <tr><td colSpan="4" className="empty">Chưa ghi nhận bệnh nền nào.</td></tr>}
            {co.data?.items.map((c) => (
              <tr key={c.id} className={c.active ? '' : 'row-off'}>
                <td>{c.name}</td><td className="wrap">{c.note ?? '\u2014'}</td><td>{c.active ? 'Đang theo dõi' : 'Ngừng theo dõi'}</td>
                <td><button className="btn btn-sm btn-ghost" onClick={() => toggle(H.updateCondition, c, c.name)}>{c.active ? 'Ngừng theo dõi' : 'Theo dõi lại'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialog === 'allergy' && <AllergyModal childId={childId} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'condition' && <ConditionModal childId={childId} onClose={() => setDialog(null)} onDone={done} />}
    </div>
  )
}
function AllergyModal({ childId, onClose, onDone }) {
  const [f, setF] = useState({ allergen: '', severity: 'MODERATE', note: '' })
  const [errors, setErrors] = useState({})
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const a11y = a11yOf(errors)
  return (
    <FormModal title="Thêm dị ứng" submitLabel="Lưu" onClose={onClose} errors={errors} setErrors={setErrors}
      validate={() => (f.allergen.trim() ? {} : { allergen: 'Nhập tác nhân gây dị ứng' })}
      send={() => H.createAllergy(childId, { ...f, allergen: f.allergen.trim() })} onDone={() => onDone('Đã ghi nhận dị ứng.')}>
      <Field id="allergen" label="Tác nhân gây dị ứng" error={errors.allergen}><input id="allergen" value={f.allergen} onChange={set('allergen')} {...a11y('allergen')} /></Field>
      <Field id="severity" label="Mức độ" error={errors.severity}>
        <Select id="severity" value={f.severity} onChange={set('severity')}>{Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
      </Field>
      <Field id="note" label="Ghi chú (không bắt buộc)"><textarea id="note" rows="3" value={f.note} onChange={set('note')} maxLength={1000} /></Field>
    </FormModal>
  )
}
function ConditionModal({ childId, onClose, onDone }) {
  const [f, setF] = useState({ name: '', note: '' })
  const [errors, setErrors] = useState({})
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  return (
    <FormModal title="Thêm bệnh nền" submitLabel="Lưu" onClose={onClose} errors={errors} setErrors={setErrors}
      validate={() => (f.name.trim() ? {} : { name: 'Nhập tên bệnh nền' })}
      send={() => H.createCondition(childId, { ...f, name: f.name.trim() })} onDone={() => onDone('Đã ghi nhận bệnh nền.')}>
      <Field id="name" label="Tên bệnh nền" error={errors.name}><input id="name" value={f.name} onChange={set('name')} aria-invalid={!!errors.name} /></Field>
      <Field id="note" label="Ghi chú (không bắt buộc)"><textarea id="note" rows="3" value={f.note} onChange={set('note')} maxLength={1000} /></Field>
    </FormModal>
  )
}

/* ---------- Tiêm chủng ---------- */
function VaccinesTab({ childId, onOk }) {
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useFetch(() => H.listVaccinations(childId, { page, limit: 8 }), [childId, page])
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="toolbar tight"><button className="btn btn-sm toolbar-end" onClick={() => setOpen(true)}>Thêm mũi tiêm</button></div>
      {error && <div className="alert spaced" role="alert">{error}</div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Vắc-xin</th><th>Mũi</th><th>Ngày tiêm</th><th>Hẹn mũi tiếp theo</th></tr></thead>
          <tbody>
            {loading && !data && <tr><td colSpan="4" className="empty">Đang tải...</td></tr>}
            {data?.items.length === 0 && <tr><td colSpan="4" className="empty">Chưa có mũi tiêm nào.</td></tr>}
            {data?.items.map((v) => <tr key={v.id}><td>{v.vaccineName}</td><td>{v.doseNumber}</td><td>{fmtDate(v.vaccinatedAt)}</td><td>{v.nextDueDate ? fmtDate(v.nextDueDate) : '\u2014'}</td></tr>)}
          </tbody>
        </table>
      </div>
      <Pagination pageInfo={data?.pageInfo} onChange={setPage} />
      {open && <VaccineModal childId={childId} onClose={() => setOpen(false)} onDone={() => { setOpen(false); onOk('Đã ghi nhận mũi tiêm.'); reload() }} />}
    </div>
  )
}
function VaccineModal({ childId, onClose, onDone }) {
  const [f, setF] = useState({ vaccineName: '', doseNumber: '1', vaccinatedAt: todayStr(), nextDueDate: '' })
  const [errors, setErrors] = useState({})
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const a11y = a11yOf(errors)
  const validate = () => {
    const errs = {}
    if (!f.vaccineName.trim()) errs.vaccineName = 'Nhập tên vắc-xin'
    const d = Number(f.doseNumber)
    if (!Number.isInteger(d) || d < 1 || d > 10) errs.doseNumber = 'Mũi số từ 1 đến 10'
    if (!f.vaccinatedAt) errs.vaccinatedAt = 'Chọn ngày tiêm'
    else if (f.vaccinatedAt > todayStr()) errs.vaccinatedAt = 'Ngày tiêm không được ở tương lai'
    if (f.nextDueDate && f.nextDueDate <= f.vaccinatedAt) errs.nextDueDate = 'Ngày hẹn phải sau ngày tiêm'
    return errs
  }
  return (
    <FormModal title="Thêm mũi tiêm" submitLabel="Lưu" onClose={onClose} validate={validate} errors={errors} setErrors={setErrors}
      send={() => H.createVaccination(childId, { vaccineName: f.vaccineName.trim(), doseNumber: Number(f.doseNumber), vaccinatedAt: f.vaccinatedAt, nextDueDate: f.nextDueDate || undefined })} onDone={onDone}>
      <Field id="vaccineName" label="Tên vắc-xin" error={errors.vaccineName}><input id="vaccineName" value={f.vaccineName} onChange={set('vaccineName')} {...a11y('vaccineName')} /></Field>
      <div className="form-grid">
        <Field id="doseNumber" label="Mũi số" error={errors.doseNumber}><input id="doseNumber" type="number" min="1" max="10" value={f.doseNumber} onChange={set('doseNumber')} {...a11y('doseNumber')} /></Field>
        <Field id="vaccinatedAt" label="Ngày tiêm" error={errors.vaccinatedAt}><input id="vaccinatedAt" type="date" max={todayStr()} value={f.vaccinatedAt} onChange={set('vaccinatedAt')} {...a11y('vaccinatedAt')} /></Field>
      </div>
      <Field id="nextDueDate" label="Hẹn mũi tiếp theo (không bắt buộc)" error={errors.nextDueDate}><input id="nextDueDate" type="date" min={f.vaccinatedAt} value={f.nextDueDate} onChange={set('nextDueDate')} {...a11y('nextDueDate')} /></Field>
    </FormModal>
  )
}

/* ---------- Khám và thuốc ---------- */
function VisitsTab({ childId, onOk }) {
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useFetch(() => H.listVisits(childId, { page, limit: 5 }), [childId, page])
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="toolbar tight"><button className="btn btn-sm toolbar-end" onClick={() => setOpen(true)}>Thêm lần khám</button></div>
      {error && <div className="alert spaced" role="alert">{error}</div>}
      {loading && !data && <p className="muted">Đang tải...</p>}
      {data?.items.length === 0 && <div className="panel empty-panel">Chưa có lần khám nào.</div>}
      <div className="timeline">
        {data?.items.map((v) => (
          <article key={v.id} className="card">
            <header><h3>{fmtDT(v.visitedAt)}</h3><span className="muted">{v.examinerName}</span></header>
            {v.symptoms && <p><b>Triệu chứng:</b> {v.symptoms}</p>}
            {v.conclusion && <p><b>Kết luận:</b> {v.conclusion}</p>}
            {v.medications.length > 0 && <ul className="plain-list">{v.medications.map((m, i) => <li key={i}>{m.name} {m.dosage}, {m.schedule}</li>)}</ul>}
          </article>
        ))}
      </div>
      <Pagination pageInfo={data?.pageInfo} onChange={setPage} />
      {open && <VisitModal childId={childId} onClose={() => setOpen(false)} onDone={() => { setOpen(false); onOk('Đã ghi nhận lần khám.'); reload() }} />}
    </div>
  )
}
function VisitModal({ childId, onClose, onDone }) {
  const [f, setF] = useState({ visitedAt: `${todayStr()}T${nowTime()}`, symptoms: '', conclusion: '' })
  const [meds, setMeds] = useState([])
  const [errors, setErrors] = useState({})
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const setMed = (i, k) => (e) => setMeds((l) => l.map((m, j) => (j === i ? { ...m, [k]: e.target.value } : m)))
  const validate = () => {
    const errs = {}
    if (!f.visitedAt) errs.visitedAt = 'Chọn thời điểm khám'
    else if (f.visitedAt > `${todayStr()}T${nowTime()}`) errs.visitedAt = 'Thời điểm khám không được ở tương lai'
    if (!f.symptoms.trim() && !f.conclusion.trim()) errs.symptoms = 'Nhập triệu chứng hoặc kết luận'
    if (meds.some((m) => (m.name || m.dosage || m.schedule) && !(m.name && m.dosage && m.schedule))) errs.medications = 'Mỗi loại thuốc cần đủ tên, liều dùng và lịch dùng'
    return errs
  }
  return (
    <FormModal title="Thêm lần khám" submitLabel="Lưu" onClose={onClose} validate={validate} errors={errors} setErrors={setErrors}
      send={() => H.createVisit(childId, { ...f, visitedAt: localIso(f.visitedAt.slice(0, 10), f.visitedAt.slice(11, 16)), medications: meds })} onDone={onDone}>
      <Field id="visitedAt" label="Thời điểm khám" error={errors.visitedAt}><input id="visitedAt" type="datetime-local" max={`${todayStr()}T${nowTime()}`} value={f.visitedAt} onChange={set('visitedAt')} aria-invalid={!!errors.visitedAt} /></Field>
      <Field id="symptoms" label="Triệu chứng" error={errors.symptoms}><textarea id="symptoms" rows="2" value={f.symptoms} onChange={set('symptoms')} aria-invalid={!!errors.symptoms} /></Field>
      <Field id="conclusion" label="Kết luận / chẩn đoán"><textarea id="conclusion" rows="2" value={f.conclusion} onChange={set('conclusion')} /></Field>
      <fieldset className="plain">
        <legend>Thuốc</legend>
        {meds.map((m, i) => (
          <div key={i} className="med-row">
            <input aria-label="Tên thuốc" placeholder="Tên thuốc" value={m.name} onChange={setMed(i, 'name')} />
            <input aria-label="Liều dùng" placeholder="Liều dùng" value={m.dosage} onChange={setMed(i, 'dosage')} />
            <input aria-label="Lịch dùng" placeholder="Lịch dùng" value={m.schedule} onChange={setMed(i, 'schedule')} />
            <button type="button" className="btn btn-sm btn-ghost" aria-label="Bỏ thuốc này" onClick={() => setMeds((l) => l.filter((_, j) => j !== i))}>&times;</button>
          </div>
        ))}
        {errors.medications && <span className="field-err">{errors.medications}</span>}
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMeds((l) => [...l, { name: '', dosage: '', schedule: '' }])}>Thêm thuốc</button>
      </fieldset>
    </FormModal>
  )
}
