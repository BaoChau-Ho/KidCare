import { useState } from 'react'
import AppShell from '../../components/AppShell.jsx'
import Field from '../../components/Field.jsx'
import Select from '../../components/Select.jsx'
import Modal from '../../components/Modal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Pagination from '../../components/Pagination.jsx'
import useFetch from '../../hooks/useFetch.js'
import { listLeaveRequests, approveLeave, rejectLeave } from '../../services/leave.js'
import { LEAVE_STATUS, fmtDate } from '../../services/labels.js'

// UC-08 (phía giáo viên) — Duyệt hoặc từ chối đơn xin nghỉ của lớp mình phụ trách
export default function LeaveRequestsPage() {
  const [status, setStatus] = useState('PENDING')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useFetch(() => listLeaveRequests({ status, page, limit: 10 }), [status, page])
  const [dialog, setDialog] = useState(null) // { type: 'approve' | 'reject', item }
  const [flash, setFlash] = useState('')
  const done = (m) => { setDialog(null); setFlash(m); reload() }

  return (
    <AppShell title="Đơn xin nghỉ">
      {flash && <div className="notice spaced" role="status">{flash}</div>}
      <div className="toolbar">
        <Select aria-label="Lọc theo trạng thái" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(LEAVE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      {error && <div className="alert spaced" role="alert">{error} <button className="link-btn" onClick={reload}>Thử lại</button></div>}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Trẻ</th><th>Thời gian nghỉ</th><th>Lý do</th><th>Người gửi</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {loading && !data && <tr><td colSpan="6" className="empty">Đang tải...</td></tr>}
            {data?.items.length === 0 && <tr><td colSpan="6" className="empty">{status === 'PENDING' ? 'Không có đơn nào đang chờ duyệt.' : 'Không có đơn nào khớp bộ lọc.'}</td></tr>}
            {data?.items.map((l) => (
              <tr key={l.id}>
                <td>{l.childName}<br /><span className="muted">{l.className}</span></td>
                <td>{l.fromDate === l.toDate ? fmtDate(l.fromDate) : `${fmtDate(l.fromDate)} - ${fmtDate(l.toDate)}`}</td>
                <td className="wrap">{l.reason}</td>
                <td>{l.parentName}</td>
                <td>
                  <span className={`badge ${l.status.toLowerCase()}`}>{LEAVE_STATUS[l.status]}</span>
                  {l.decisionReason && <div className="muted">{l.decisionReason}</div>}
                </td>
                <td>
                  {l.status === 'PENDING' && (
                    <div className="actions">
                      <button className="btn btn-sm" onClick={() => { setFlash(''); setDialog({ type: 'approve', item: l }) }}>Duyệt</button>
                      <button className="btn btn-sm btn-danger" onClick={() => { setFlash(''); setDialog({ type: 'reject', item: l }) }}>Từ chối</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pageInfo={data?.pageInfo} onChange={setPage} />

      {dialog?.type === 'approve' && <ApproveDialog item={dialog.item} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.type === 'reject' && <RejectDialog item={dialog.item} onClose={() => setDialog(null)} onDone={done} />}
    </AppShell>
  )
}

function ApproveDialog({ item, onClose, onDone }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const run = async () => {
    setBusy(true); setErr('')
    try { await approveLeave(item.id); onDone(`Đã duyệt đơn nghỉ của ${item.childName}. Các ngày nghỉ sẽ hiện là vắng có phép trên bảng điểm danh.`) }
    catch (e) { setErr(e.message); setBusy(false) }
  }
  return <ConfirmDialog title="Duyệt đơn xin nghỉ" message={`Duyệt đơn nghỉ của ${item.childName} từ ${fmtDate(item.fromDate)} đến ${fmtDate(item.toDate)}?`} confirmLabel="Duyệt đơn" busy={busy} error={err} onConfirm={run} onCancel={onClose} />
}

function RejectDialog({ item, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (!reason.trim()) return setErr('Nhập lý do từ chối.')
    setBusy(true); setErr('')
    try { await rejectLeave(item.id, reason.trim()); onDone(`Đã từ chối đơn nghỉ của ${item.childName}.`) }
    catch (x) { setErr(x.message); setBusy(false) }
  }
  return (
    <Modal title="Từ chối đơn xin nghỉ" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {err && <div className="alert" role="alert">{err}</div>}
        <Field id="reason" label="Lý do (gửi cho phụ huynh)">
          <textarea id="reason" rows="3" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} disabled={busy}>Hủy</button>
          <button type="submit" className="btn btn-sm btn-danger" disabled={busy}>{busy ? 'Đang gửi...' : 'Từ chối đơn'}</button>
        </div>
      </form>
    </Modal>
  )
}
