import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AppShell from '../../components/AppShell.jsx'
import Field from '../../components/Field.jsx'
import Select from '../../components/Select.jsx'
import Modal from '../../components/Modal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Pagination from '../../components/Pagination.jsx'
import useFetch from '../../hooks/useFetch.js'
import { listChildren } from '../../services/children.js'
import { listLeaveRequests, createLeaveRequest, cancelLeave } from '../../services/leave.js'
import { LEAVE_STATUS, fmtDate } from '../../services/labels.js'
import { todayStr } from '../../services/dates.js'

// UC-08 — Phụ huynh gửi đơn xin nghỉ cho con và theo dõi trạng thái
export default function LeavePage() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useFetch(() => listLeaveRequests({ status, page, limit: 10 }), [status, page])
  const { data: kidsPage } = useFetch(() => listChildren({ limit: 50 }), [])
  const kids = (kidsPage?.items ?? []).filter((c) => c.status === 'ACTIVE')
  const [dialog, setDialog] = useState(params.get('childId') ? { type: 'create' } : null)
  const [flash, setFlash] = useState('')
  const done = (m) => { setDialog(null); setFlash(m); reload() }

  return (
    <AppShell title="Xin nghỉ học">
      {flash && <div className="notice spaced" role="status">{flash}</div>}
      <div className="toolbar">
        <Select aria-label="Lọc theo trạng thái" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(LEAVE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <button className="btn btn-sm toolbar-end" disabled={kids.length === 0} onClick={() => { setFlash(''); setDialog({ type: 'create' }) }}>Gửi đơn mới</button>
      </div>
      {kidsPage && kids.length === 0 && <div className="notice spaced">Chưa có trẻ nào được liên kết với tài khoản của bạn nên chưa thể gửi đơn.</div>}
      {error && <div className="alert spaced" role="alert">{error} <button className="link-btn" onClick={reload}>Thử lại</button></div>}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Trẻ</th><th>Thời gian nghỉ</th><th>Lý do</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {loading && !data && <tr><td colSpan="5" className="empty">Đang tải...</td></tr>}
            {data?.items.length === 0 && <tr><td colSpan="5" className="empty">Bạn chưa gửi đơn xin nghỉ nào.</td></tr>}
            {data?.items.map((l) => (
              <tr key={l.id}>
                <td>{l.childName}</td>
                <td>{l.fromDate === l.toDate ? fmtDate(l.fromDate) : `${fmtDate(l.fromDate)} - ${fmtDate(l.toDate)}`}</td>
                <td className="wrap">{l.reason}</td>
                <td><span className={`badge ${l.status.toLowerCase()}`}>{LEAVE_STATUS[l.status]}</span>{l.decisionReason && <div className="muted">{l.decisionReason}</div>}</td>
                <td>{l.status === 'PENDING' && <button className="btn btn-sm btn-ghost" onClick={() => { setFlash(''); setDialog({ type: 'cancel', item: l }) }}>Rút đơn</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pageInfo={data?.pageInfo} onChange={setPage} />

      {dialog?.type === 'create' && <CreateModal kids={kids} defaultChild={params.get('childId')} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.type === 'cancel' && <CancelDialog item={dialog.item} onClose={() => setDialog(null)} onDone={done} />}
    </AppShell>
  )
}

function CreateModal({ kids, defaultChild, onClose, onDone }) {
  const [form, setForm] = useState({ childId: kids.find((k) => k.id === defaultChild)?.id ?? kids[0]?.id ?? '', fromDate: todayStr(), toDate: todayStr(), reason: '' })
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
    if (!form.fromDate) errs.fromDate = 'Chọn ngày bắt đầu'
    else if (form.fromDate < todayStr()) errs.fromDate = 'Không thể xin nghỉ cho ngày đã qua'
    if (!form.toDate) errs.toDate = 'Chọn ngày kết thúc'
    else if (form.toDate < form.fromDate) errs.toDate = 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu'
    if (!form.reason.trim()) errs.reason = 'Nhập lý do xin nghỉ'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      await createLeaveRequest({ ...form, reason: form.reason.trim() })
      onDone('Đã gửi đơn xin nghỉ. Giáo viên của lớp sẽ nhận được thông báo.')
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message }); else setFormError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Gửi đơn xin nghỉ" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {formError && <div className="alert" role="alert">{formError}</div>}
        <Field id="childId" label="Trẻ" error={errors.childId}>
          <Select id="childId" value={form.childId} onChange={set('childId')} {...a11y('childId')}>
            {kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </Select>
        </Field>
        <div className="form-grid">
          <Field id="fromDate" label="Từ ngày" error={errors.fromDate}>
            <input id="fromDate" type="date" min={todayStr()} value={form.fromDate} onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value, toDate: f.toDate < e.target.value ? e.target.value : f.toDate }))} {...a11y('fromDate')} />
          </Field>
          <Field id="toDate" label="Đến ngày" error={errors.toDate}>
            <input id="toDate" type="date" min={form.fromDate || todayStr()} value={form.toDate} onChange={set('toDate')} {...a11y('toDate')} />
          </Field>
        </div>
        <Field id="reason" label="Lý do" error={errors.reason}>
          <textarea id="reason" rows="3" value={form.reason} onChange={set('reason')} maxLength={1000} {...a11y('reason')} />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} disabled={busy}>Hủy</button>
          <button type="submit" className="btn btn-sm" disabled={busy}>{busy ? 'Đang gửi...' : 'Gửi đơn'}</button>
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
    try { await cancelLeave(item.id); onDone('Đã rút đơn xin nghỉ.') } catch (e) { setErr(e.message); setBusy(false) }
  }
  return <ConfirmDialog title="Rút đơn xin nghỉ" message={`Rút đơn xin nghỉ của ${item.childName} (${fmtDate(item.fromDate)} - ${fmtDate(item.toDate)})?`} confirmLabel="Rút đơn" danger busy={busy} error={err} onConfirm={run} onCancel={onClose} />
}
