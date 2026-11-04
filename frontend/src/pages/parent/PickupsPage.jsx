import { useState } from 'react'
import AppShell from '../../components/AppShell.jsx'
import Field from '../../components/Field.jsx'
import Select from '../../components/Select.jsx'
import Modal from '../../components/Modal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Pagination from '../../components/Pagination.jsx'
import useFetch from '../../hooks/useFetch.js'
import { listChildren } from '../../services/children.js'
import { listPickups, createPickup, cancelPickup } from '../../services/pickups.js'
import { PICKUP_STATUS, PICKER_RELATIONS, fmtDT } from '../../services/labels.js'
import { todayStr, nowTime, localIso } from '../../services/dates.js'

const ID_RE = /^\d{9}$|^\d{12}$/
const PHONE_RE = /^\+?\d{9,12}$/

// UC-11 — Phụ huynh đăng ký trước người được phép đón trẻ để giáo viên xác minh
export default function PickupsPage() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useFetch(() => listPickups({ status, page, limit: 10 }), [status, page])
  const { data: kidsPage } = useFetch(() => listChildren({ limit: 50 }), [])
  const kids = (kidsPage?.items ?? []).filter((c) => c.status === 'ACTIVE')
  const [dialog, setDialog] = useState(null)
  const [flash, setFlash] = useState('')
  const done = (m) => { setDialog(null); setFlash(m); reload() }

  return (
    <AppShell title="Đăng ký người đón trẻ">
      {flash && <div className="notice spaced" role="status">{flash}</div>}
      <div className="toolbar">
        <Select aria-label="Lọc theo trạng thái" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(PICKUP_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <button className="btn btn-sm toolbar-end" disabled={kids.length === 0} onClick={() => { setFlash(''); setDialog({ type: 'create' }) }}>Đăng ký người đón</button>
      </div>
      {kidsPage && kids.length === 0 && <div className="notice spaced">Chưa có trẻ nào được liên kết với tài khoản của bạn.</div>}
      {error && <div className="alert spaced" role="alert">{error} <button className="link-btn" onClick={reload}>Thử lại</button></div>}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Trẻ</th><th>Người đón</th><th>Giấy tờ</th><th>Dự kiến</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {loading && !data && <tr><td colSpan="6" className="empty">Đang tải...</td></tr>}
            {data?.items.length === 0 && <tr><td colSpan="6" className="empty">Bạn chưa đăng ký người đón nào.</td></tr>}
            {data?.items.map((p) => (
              <tr key={p.id}>
                <td>{p.childName}</td>
                <td>{p.pickupPerson}<br /><span className="muted">{p.relationship}{p.phone ? `, ${p.phone}` : ''}</span></td>
                <td>{p.idNumber}</td>
                <td>{fmtDT(p.expectedTime)}</td>
                <td><span className={`badge ${p.status.toLowerCase()}`}>{PICKUP_STATUS[p.status]}</span>{p.decisionReason && <div className="muted">{p.decisionReason}</div>}</td>
                <td>{p.status === 'PENDING' && <button className="btn btn-sm btn-ghost" onClick={() => { setFlash(''); setDialog({ type: 'cancel', item: p }) }}>Hủy</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pageInfo={data?.pageInfo} onChange={setPage} />
      <p className="muted spaced">Giấy tờ của người đón chỉ hiện 4 số cuối. Giáo viên sẽ đối chiếu giấy tờ khi người đón đến lớp.</p>

      {dialog?.type === 'create' && <CreateModal kids={kids} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.type === 'cancel' && <CancelDialog item={dialog.item} onClose={() => setDialog(null)} onDone={done} />}
    </AppShell>
  )
}

function CreateModal({ kids, onClose, onDone }) {
  const [form, setForm] = useState({ childId: kids[0]?.id ?? '', pickupPerson: '', relationship: PICKER_RELATIONS[0], idNumber: '', phone: '', expectedTime: `${todayStr()}T${nowTime()}` })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const a11y = (k) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${k}-err` : undefined })

  const submit = async (e) => {
    e.preventDefault()
    setFormError('')
    const errs = {}
    if (!form.childId) errs.childId = 'Chọn trẻ'
    if (!form.pickupPerson.trim()) errs.pickupPerson = 'Nhập họ tên người đón'
    if (!ID_RE.test(form.idNumber.trim())) errs.idNumber = 'Số giấy tờ phải gồm 9 hoặc 12 chữ số'
    if (form.phone && !PHONE_RE.test(form.phone.replace(/\s/g, ''))) errs.phone = 'Số điện thoại không hợp lệ'
    if (!form.expectedTime) errs.expectedTime = 'Chọn thời gian dự kiến'
    else if (form.expectedTime < `${todayStr()}T${nowTime()}`) errs.expectedTime = 'Thời gian dự kiến không được ở quá khứ'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      await createPickup({ ...form, expectedTime: localIso(form.expectedTime.slice(0, 10), form.expectedTime.slice(11, 16)), pickupPerson: form.pickupPerson.trim(), idNumber: form.idNumber.trim(), phone: form.phone.trim() || undefined })
      onDone('Đã gửi đăng ký. Giáo viên sẽ xác minh người đón.')
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message }); else setFormError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Đăng ký người đón trẻ" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {formError && <div className="alert" role="alert">{formError}</div>}
        <Field id="childId" label="Trẻ" error={errors.childId}>
          <Select id="childId" value={form.childId} onChange={set('childId')} {...a11y('childId')}>
            {kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </Select>
        </Field>
        <Field id="pickupPerson" label="Họ tên người đón" error={errors.pickupPerson}>
          <input id="pickupPerson" value={form.pickupPerson} onChange={set('pickupPerson')} maxLength={150} {...a11y('pickupPerson')} />
        </Field>
        <div className="form-grid">
          <Field id="relationship" label="Quan hệ với trẻ" error={errors.relationship}>
            <Select id="relationship" value={form.relationship} onChange={set('relationship')}>
              {PICKER_RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          <Field id="phone" label="Số điện thoại" error={errors.phone}>
            <input id="phone" type="tel" value={form.phone} onChange={set('phone')} {...a11y('phone')} />
          </Field>
        </div>
        <Field id="idNumber" label="Số CCCD/CMND của người đón" error={errors.idNumber} hint="Chỉ giáo viên của lớp xem được để đối chiếu.">
          <input id="idNumber" inputMode="numeric" maxLength={12} autoComplete="off" value={form.idNumber} onChange={set('idNumber')} {...a11y('idNumber')} />
        </Field>
        <Field id="expectedTime" label="Thời gian đón dự kiến" error={errors.expectedTime}>
          <input id="expectedTime" type="datetime-local" min={`${todayStr()}T${nowTime()}`} value={form.expectedTime} onChange={set('expectedTime')} {...a11y('expectedTime')} />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} disabled={busy}>Hủy</button>
          <button type="submit" className="btn btn-sm" disabled={busy}>{busy ? 'Đang gửi...' : 'Gửi đăng ký'}</button>
        </div>
      </form>
    </Modal>
  )
}

function CancelDialog({ item, onClose, onDone }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const run = async () => {
    setBusy(true); setErr('')
    try { await cancelPickup(item.id); onDone('Đã hủy đăng ký người đón.') } catch (e) { setErr(e.message); setBusy(false) }
  }
  return <ConfirmDialog title="Hủy đăng ký người đón" message={`Hủy đăng ký cho ${item.pickupPerson} đón ${item.childName}?`} confirmLabel="Hủy đăng ký" danger busy={busy} error={err} onConfirm={run} onCancel={onClose} />
}
