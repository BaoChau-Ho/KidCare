import { useState } from 'react'
import AppShell from '../../components/AppShell.jsx'
import Field from '../../components/Field.jsx'
import Select from '../../components/Select.jsx'
import Modal from '../../components/Modal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Pagination from '../../components/Pagination.jsx'
import useFetch from '../../hooks/useFetch.js'
import { listPickups, approvePickup, rejectPickup, completePickup } from '../../services/pickups.js'
import { PICKUP_STATUS, fmtTime, fmtDate } from '../../services/labels.js'
import { todayStr } from '../../services/dates.js'

const mask = (s) => (s ? '\u2022'.repeat(Math.max(0, s.length - 4)) + s.slice(-4) : '\u2014')

// UC-12 — Xác nhận đón trẻ: đối chiếu người đón, duyệt/từ chối, giao trẻ (ghi check-out)
export default function PickupsPage() {
  const [date, setDate] = useState(todayStr())
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useFetch(() => listPickups({ date, status, page, limit: 10 }), [date, status, page])
  const [dialog, setDialog] = useState(null) // { type: 'approve' | 'reject' | 'complete', item }
  const [revealed, setRevealed] = useState({})
  const [flash, setFlash] = useState('')
  const done = (m) => { setDialog(null); setFlash(m); reload() }

  return (
    <AppShell title="Xác nhận đón trẻ">
      {flash && <div className="notice spaced" role="status">{flash}</div>}
      <div className="toolbar">
        <div className="field-inline">
          <label htmlFor="pdate">Ngày đón</label>
          <input id="pdate" type="date" value={date} onChange={(e) => { if (e.target.value) { setDate(e.target.value); setPage(1) } }} />
        </div>
        <Select aria-label="Lọc theo trạng thái" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(PICKUP_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      {error && <div className="alert spaced" role="alert">{error} <button className="link-btn" onClick={reload}>Thử lại</button></div>}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Trẻ</th><th>Người đón</th><th>Giấy tờ</th><th>Dự kiến</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {loading && !data && <tr><td colSpan="6" className="empty">Đang tải...</td></tr>}
            {data?.items.length === 0 && <tr><td colSpan="6" className="empty">Không có yêu cầu đón trẻ nào trong ngày {fmtDate(date)}.</td></tr>}
            {data?.items.map((p) => (
              <tr key={p.id}>
                <td>{p.childName}<br /><span className="muted">{p.className}</span></td>
                <td>{p.pickupPerson}<br /><span className="muted">{p.relationship}{p.phone ? `, ${p.phone}` : ''}</span></td>
                <td>
                  {revealed[p.id] ? p.idNumber : mask(p.idNumber)}{' '}
                  <button className="link-btn" onClick={() => setRevealed((v) => ({ ...v, [p.id]: !v[p.id] }))}>{revealed[p.id] ? 'Ẩn' : 'Hiện'}</button>
                </td>
                <td>{fmtTime(p.expectedTime)}</td>
                <td>
                  <span className={`badge ${p.status.toLowerCase()}`}>{PICKUP_STATUS[p.status]}</span>
                  {p.decisionReason && <div className="muted">{p.decisionReason}</div>}
                </td>
                <td>
                  <div className="actions">
                    {p.status === 'PENDING' && (
                      <>
                        <button className="btn btn-sm" onClick={() => { setFlash(''); setDialog({ type: 'approve', item: p }) }}>Xác minh</button>
                        <button className="btn btn-sm btn-danger" onClick={() => { setFlash(''); setDialog({ type: 'reject', item: p }) }}>Từ chối</button>
                      </>
                    )}
                    {p.status === 'APPROVED' && <button className="btn btn-sm" onClick={() => { setFlash(''); setDialog({ type: 'complete', item: p }) }}>Giao trẻ</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pageInfo={data?.pageInfo} onChange={setPage} />
      <p className="muted spaced">Hãy đối chiếu giấy tờ của người đến đón với thông tin ở đây trước khi giao trẻ. Số giấy tờ được ẩn mặc định.</p>

      {dialog?.type === 'approve' && (
        <Act title="Xác minh người đón" confirmLabel="Xác minh" item={dialog.item} onClose={() => setDialog(null)}
          message={`Xác nhận thông tin của ${dialog.item.pickupPerson} (${dialog.item.relationship}) khớp để đón ${dialog.item.childName}?`}
          run={() => approvePickup(dialog.item.id)} okText={`Đã xác minh người đón ${dialog.item.childName}.`} onDone={done} />
      )}
      {dialog?.type === 'complete' && (
        <Act title="Xác nhận giao trẻ" confirmLabel="Giao trẻ" item={dialog.item} onClose={() => setDialog(null)}
          message={`Giao ${dialog.item.childName} cho ${dialog.item.pickupPerson}? Hệ thống sẽ ghi check-out cho bé và thông báo cho phụ huynh.`}
          run={() => completePickup(dialog.item.id)} okText={`Đã giao ${dialog.item.childName} và ghi check-out.`} onDone={done} />
      )}
      {dialog?.type === 'reject' && <RejectDialog item={dialog.item} onClose={() => setDialog(null)} onDone={done} />}
    </AppShell>
  )
}

function Act({ title, message, confirmLabel, run, okText, onClose, onDone }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const go = async () => {
    setBusy(true); setErr('')
    try { await run(); onDone(okText) } catch (e) { setErr(e.message); setBusy(false) }
  }
  return <ConfirmDialog title={title} message={message} confirmLabel={confirmLabel} busy={busy} error={err} onConfirm={go} onCancel={onClose} />
}

function RejectDialog({ item, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (!reason.trim()) return setErr('Nhập lý do từ chối.')
    setBusy(true); setErr('')
    try { await rejectPickup(item.id, reason.trim()); onDone(`Đã từ chối yêu cầu đón ${item.childName}.`) }
    catch (x) { setErr(x.message); setBusy(false) }
  }
  return (
    <Modal title="Từ chối người đón" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {err && <div className="alert" role="alert">{err}</div>}
        <Field id="reason" label="Lý do (gửi cho phụ huynh)">
          <textarea id="reason" rows="3" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} disabled={busy}>Hủy</button>
          <button type="submit" className="btn btn-sm btn-danger" disabled={busy}>{busy ? 'Đang gửi...' : 'Từ chối'}</button>
        </div>
      </form>
    </Modal>
  )
}
