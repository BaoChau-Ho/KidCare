import { useState } from 'react'
import AppShell from '../../components/AppShell.jsx'
import Field from '../../components/Field.jsx'
import Select from '../../components/Select.jsx'
import Modal from '../../components/Modal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import useFetch from '../../hooks/useFetch.js'
import useMyClasses from '../../hooks/useMyClasses.js'
import { getRoster, checkIn, checkOut, updateAttendance } from '../../services/attendance.js'
import { getClassAlerts } from '../../services/health.js'
import { ATTENDANCE_STATUS, SEVERITY, fmtTime } from '../../services/labels.js'
import { todayStr, nowTime, hhmm, localIso } from '../../services/dates.js'

// UC-06 — Điểm danh: chọn lớp + ngày, check-in/check-out, ghi vắng, sửa bản ghi
export default function AttendancePage() {
  const { classes, loading: loadingClasses } = useMyClasses()
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(todayStr())
  const cid = classId || classes[0]?.id || ''
  const isToday = date === todayStr()

  const { data, loading, error, reload } = useFetch(() => (cid ? getRoster(cid, date) : Promise.resolve(null)), [cid, date])
  const { data: alerts } = useFetch(() => (cid ? getClassAlerts(cid) : Promise.resolve(null)), [cid])
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null) // { type: 'ok' | 'err', text }
  const [dialog, setDialog] = useState(null) // { type: 'time' | 'edit' | 'leave', kind?, item }

  const alertsOf = (childId) => (alerts ?? []).filter((a) => a.childId === childId)
  const items = data?.items ?? []
  const count = (f) => items.filter(f).length

  const run = async (key, fn, okText) => {
    setBusy(key); setMsg(null)
    try { await fn(); setMsg({ type: 'ok', text: okText }); reload() }
    catch (e) { setMsg({ type: 'err', text: e.message }) }
    finally { setBusy('') }
  }
  const doIn = (it, time) => run(it.childId, () => checkIn({ childId: it.childId, date, ...(time ? { checkInTime: localIso(date, time) } : {}) }), `Đã check-in cho ${it.name}.`)
  const doOut = (it, time) => run(it.childId, () => checkOut({ childId: it.childId, date, ...(time ? { checkOutTime: localIso(date, time) } : {}) }), `Đã check-out cho ${it.name}.`)
  const doAbsent = (it) => run(it.childId, () => checkIn({ childId: it.childId, date, status: 'ABSENT' }), `Đã ghi vắng cho ${it.name}.`)

  // Hôm nay: bấm là ghi ngay giờ hiện tại. Ngày đã qua: hỏi giờ.
  const startIn = (it) => {
    if (it.onLeave) return setDialog({ type: 'leave', item: it })
    if (isToday) doIn(it); else setDialog({ type: 'time', kind: 'in', item: it })
  }
  const startOut = (it) => { if (isToday) doOut(it); else setDialog({ type: 'time', kind: 'out', item: it }) }

  const label = (it) => (it.status === 'ABSENT' && it.onLeave && !it.attendanceId ? 'Nghỉ có phép' : ATTENDANCE_STATUS[it.status])

  return (
    <AppShell title="Điểm danh">
      <div className="toolbar">
        <div className="field-inline">
          <label htmlFor="class">Lớp</label>
          <Select id="class" value={cid} onChange={(e) => setClassId(e.target.value)} disabled={classes.length === 0}>
            {classes.length === 0 && <option value="">Chưa có lớp</option>}
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.academicYear})</option>)}
          </Select>
        </div>
        <div className="field-inline">
          <label htmlFor="date">Ngày</label>
          <input id="date" type="date" max={todayStr()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
        {!isToday && <button className="btn btn-sm btn-ghost" onClick={() => setDate(todayStr())}>Về hôm nay</button>}
      </div>

      {msg && <div className={msg.type === 'ok' ? 'notice spaced' : 'alert spaced'} role={msg.type === 'ok' ? 'status' : 'alert'}>{msg.text}</div>}
      {error && <div className="alert spaced" role="alert">{error} <button className="link-btn" onClick={reload}>Thử lại</button></div>}
      {!loadingClasses && classes.length === 0 && <div className="notice spaced">Bạn chưa được phân công lớp nào. Hãy liên hệ quản lý cơ sở.</div>}

      {cid && (
        <div className="stats">
          <div className="stat"><b>{count((i) => i.status === 'PRESENT')}</b><span>Có mặt</span></div>
          <div className="stat"><b>{count((i) => i.status === 'LATE')}</b><span>Đi muộn</span></div>
          <div className="stat"><b>{count((i) => i.status === 'ABSENT')}</b><span>Vắng</span></div>
          <div className="stat"><b>{count((i) => i.status === 'NOT_CHECKED_IN')}</b><span>Chưa điểm danh</span></div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Trẻ</th><th>Trạng thái</th><th>Giờ đến</th><th>Giờ về</th><th>Thao tác</th></tr></thead>
          <tbody>
            {loading && !data && <tr><td colSpan="5" className="empty">Đang tải...</td></tr>}
            {data && items.length === 0 && <tr><td colSpan="5" className="empty">Lớp chưa có trẻ đang học.</td></tr>}
            {items.map((it) => (
              <tr key={it.childId}>
                <td>
                  {it.name}
                  {alertsOf(it.childId).length > 0 && (
                    <div className="chips alert-chips">
                      {alertsOf(it.childId).map((a, i) => (
                        <span key={i} className="chip chip-warn" title="Lưu ý sức khỏe">{'\u26A0'} {a.allergen}{a.severity ? ` (${SEVERITY[a.severity]})` : ''}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <span className={`badge ${it.status.toLowerCase()}`}>{label(it)}</span>
                  {it.earlyLeave && <> <span className="badge late">Về sớm</span></>}
                </td>
                <td>{fmtTime(it.checkInTime)}</td>
                <td>{fmtTime(it.checkOutTime)}</td>
                <td>
                  <div className="actions">
                    {!it.attendanceId && (
                      <>
                        <button className="btn btn-sm" disabled={busy === it.childId} onClick={() => startIn(it)}>Check-in</button>
                        {!it.onLeave && <button className="btn btn-sm btn-ghost" disabled={busy === it.childId} onClick={() => doAbsent(it)}>Vắng</button>}
                      </>
                    )}
                    {it.attendanceId && it.status !== 'ABSENT' && !it.checkOutTime && (
                      <button className="btn btn-sm" disabled={busy === it.childId} onClick={() => startOut(it)}>Check-out</button>
                    )}
                    {it.attendanceId && <button className="btn btn-sm btn-ghost" onClick={() => setDialog({ type: 'edit', item: it })}>Sửa</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && <p className="muted spaced">Giờ chuẩn: vào lớp {data.settings.startTime}, tan học {data.settings.endTime}. Đến sau giờ vào lớp được tính là muộn.</p>}

      {dialog?.type === 'leave' && (
        <ConfirmDialog
          title="Bé có đơn xin nghỉ"
          message={`${dialog.item.name} có đơn xin nghỉ đã được duyệt cho ngày này. Vẫn ghi nhận bé đã đến lớp?`}
          confirmLabel="Vẫn check-in"
          onCancel={() => setDialog(null)}
          onConfirm={() => { const it = dialog.item; setDialog(null); if (isToday) doIn(it); else setDialog({ type: 'time', kind: 'in', item: it }) }}
        />
      )}
      {dialog?.type === 'time' && (
        <TimeDialog
          kind={dialog.kind} item={dialog.item} settings={data?.settings} date={date}
          onClose={() => setDialog(null)}
          onSubmit={async (time) => {
            await (dialog.kind === 'in' ? checkIn({ childId: dialog.item.childId, date, checkInTime: localIso(date, time) }) : checkOut({ childId: dialog.item.childId, date, checkOutTime: localIso(date, time) }))
            setDialog(null); setMsg({ type: 'ok', text: `Đã ghi nhận cho ${dialog.item.name}.` }); reload()
          }}
        />
      )}
      {dialog?.type === 'edit' && (
        <EditDialog item={dialog.item} date={date} onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); setMsg({ type: 'ok', text: 'Đã cập nhật điểm danh.' }); reload() }} />
      )}
    </AppShell>
  )
}

function TimeDialog({ kind, item, settings, date, onClose, onSubmit }) {
  const [time, setTime] = useState(date === todayStr() ? nowTime() : kind === 'in' ? settings?.startTime ?? '07:30' : settings?.endTime ?? '16:00')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await onSubmit(time) } catch (x) { setErr(x.message); setBusy(false) }
  }
  return (
    <Modal title={`${kind === 'in' ? 'Check-in' : 'Check-out'}: ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {err && <div className="alert" role="alert">{err}</div>}
        <Field id="time" label={kind === 'in' ? 'Giờ đến' : 'Giờ về'}>
          <input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} disabled={busy}>Hủy</button>
          <button type="submit" className="btn btn-sm" disabled={busy || !time}>{busy ? 'Đang lưu...' : 'Lưu'}</button>
        </div>
      </form>
    </Modal>
  )
}

function EditDialog({ item, date, onClose, onSaved }) {
  const [status, setStatus] = useState(item.status === 'ABSENT' ? 'ABSENT' : 'PRESENT')
  const [inT, setInT] = useState(hhmm(item.checkInTime))
  const [outT, setOutT] = useState(hhmm(item.checkOutTime))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (status !== 'ABSENT' && !inT) return setErr('Nhập giờ đến.')
    setBusy(true)
    try {
      await updateAttendance(item.attendanceId, {
        status,
        checkInTime: status === 'ABSENT' || !inT ? null : localIso(date, inT),
        checkOutTime: status === 'ABSENT' || !outT ? null : localIso(date, outT),
      })
      onSaved()
    } catch (x) { setErr(x.message); setBusy(false) }
  }
  return (
    <Modal title={`Sửa điểm danh: ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {err && <div className="alert" role="alert">{err}</div>}
        <Field id="status" label="Trạng thái" hint="Đi muộn được tự tính theo giờ đến.">
          <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="PRESENT">Có mặt</option>
            <option value="ABSENT">Vắng</option>
          </Select>
        </Field>
        {status !== 'ABSENT' && (
          <div className="form-grid">
            <Field id="in" label="Giờ đến"><input id="in" type="time" value={inT} onChange={(e) => setInT(e.target.value)} /></Field>
            <Field id="out" label="Giờ về"><input id="out" type="time" value={outT} onChange={(e) => setOutT(e.target.value)} /></Field>
          </div>
        )}
        <p className="hint">Mọi thay đổi được ghi vào nhật ký (giá trị trước và sau).</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} disabled={busy}>Hủy</button>
          <button type="submit" className="btn btn-sm" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
        </div>
      </form>
    </Modal>
  )
}
