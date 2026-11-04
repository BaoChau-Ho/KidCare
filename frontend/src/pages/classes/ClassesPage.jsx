import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell.jsx'
import Field from '../../components/Field.jsx'
import Select from '../../components/Select.jsx'
import Modal from '../../components/Modal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Pagination from '../../components/Pagination.jsx'
import useFetch from '../../hooks/useFetch.js'
import useDebounce from '../../hooks/useDebounce.js'
import { listClasses, createClass, updateClass, assignTeachers, removeTeacher } from '../../services/classes.js'
import { lookupUsers } from '../../services/users.js'
import { CLASS_STATUS, USER_STATUS } from '../../services/labels.js'

const LIMIT = 10

// UC-05 — Quản lý lớp và phân công giáo viên: S1 thêm lớp, S2 sửa/đóng lớp, S3 phân công/gỡ giáo viên
export default function ClassesPage() {
  const [filters, setFilters] = useState({ academicYear: '', status: '' })
  const [page, setPage] = useState(1)
  const year = useDebounce(filters.academicYear)
  const { data, loading, error, reload } = useFetch(
    () => listClasses({ academicYear: year.trim(), status: filters.status, page, limit: LIMIT }),
    [year, filters.status, page],
  )
  const [dialog, setDialog] = useState(null) // { type: 'create' | 'edit' | 'teachers' | 'close', cls }
  const [flash, setFlash] = useState('')

  const setFilter = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1) }
  const open = (d) => { setFlash(''); setDialog(d) }
  const done = (msg) => { setDialog(null); setFlash(msg); reload() }

  return (
    <AppShell title="Quản lý lớp">
      {flash && <div className="notice spaced" role="status">{flash}</div>}

      <div className="toolbar">
        <div className="grow">
          <input type="search" placeholder="Lọc theo năm học, ví dụ 2026-2027" aria-label="Lọc theo năm học"
            value={filters.academicYear} onChange={setFilter('academicYear')} />
        </div>
        <Select aria-label="Lọc theo trạng thái" value={filters.status} onChange={setFilter('status')}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(CLASS_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <button className="btn btn-sm toolbar-end" onClick={() => open({ type: 'create' })}>Thêm lớp</button>
      </div>

      {error && <div className="alert spaced" role="alert">{error} <button className="link-btn" onClick={reload}>Thử lại</button></div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Tên lớp</th><th>Năm học</th><th>Giáo viên phụ trách</th><th>Số trẻ</th><th>Trạng thái</th><th>Thao tác</th></tr>
          </thead>
          <tbody>
            {loading && !data && <tr><td colSpan="6" className="empty">Đang tải...</td></tr>}
            {data?.items.length === 0 && <tr><td colSpan="6" className="empty">Chưa có lớp nào. Chọn "Thêm lớp" để tạo lớp đầu tiên.</td></tr>}
            {data?.items.map((c) => (
              <tr key={c.id} className={c.status === 'ACTIVE' ? '' : 'row-off'}>
                <td>{c.name}</td>
                <td>{c.academicYear}</td>
                <td>
                  {(c.teachers ?? []).length === 0
                    ? <span className="muted">Chưa phân công</span>
                    : <div className="chips">{c.teachers.map((t) => <span key={t.userId} className="chip">{t.fullName}</span>)}</div>}
                </td>
                <td>{c.childCount ?? '\u2014'}</td>
                <td><span className={`badge ${c.status.toLowerCase()}`}>{CLASS_STATUS[c.status]}</span></td>
                <td>
                  <div className="actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => open({ type: 'edit', cls: c })}>Sửa</button>
                    {c.status === 'ACTIVE' && <button className="btn btn-sm btn-ghost" onClick={() => open({ type: 'teachers', cls: c })}>Giáo viên</button>}
                    <Link className="btn btn-sm btn-ghost btn-link-inline" to={`/manager/children?classId=${c.id}`}>Xem trẻ</Link>
                    {c.status === 'ACTIVE' && <button className="btn btn-sm btn-danger" onClick={() => open({ type: 'close', cls: c })}>Đóng lớp</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pageInfo={data?.pageInfo} onChange={setPage} />

      {(dialog?.type === 'create' || dialog?.type === 'edit') && <ClassFormModal cls={dialog.cls} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog?.type === 'teachers' && <TeachersModal cls={dialog.cls} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog?.type === 'close' && <CloseDialog cls={dialog.cls} onClose={() => setDialog(null)} onSaved={done} />}
    </AppShell>
  )
}

/* S1 thêm lớp / S2 sửa lớp */
function ClassFormModal({ cls, onClose, onSaved }) {
  const editing = !!cls
  const [form, setForm] = useState({ name: cls?.name ?? '', academicYear: cls?.academicYear ?? '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const a11y = (k) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${k}-err` : undefined })

  const submit = async (e) => {
    e.preventDefault()
    setFormError('')
    const errs = {}
    if (!form.name.trim()) errs.name = 'Nhập tên lớp'
    if (form.academicYear.trim().length < 4) errs.academicYear = 'Nhập năm học, ví dụ 2026-2027'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const body = { name: form.name.trim(), academicYear: form.academicYear.trim() }
      if (editing) await updateClass(cls.id, body)
      else await createClass(body)
      onSaved(editing ? 'Đã cập nhật lớp.' : `Đã tạo lớp ${body.name}.`)
    } catch (err) {
      // S1a: trùng tên trong cùng năm học
      const key = err.field || (err.status === 409 ? 'name' : null)
      if (key) setErrors({ [key]: err.message })
      else setFormError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={editing ? 'Sửa lớp' : 'Thêm lớp'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {formError && <div className="alert" role="alert">{formError}</div>}
        <Field id="name" label="Tên lớp" error={errors.name}>
          <input id="name" value={form.name} onChange={set('name')} maxLength={100} {...a11y('name')} />
        </Field>
        <Field id="academicYear" label="Năm học" error={errors.academicYear} hint="Ví dụ 2026-2027">
          <input id="academicYear" value={form.academicYear} onChange={set('academicYear')} maxLength={20} {...a11y('academicYear')} />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} disabled={busy}>Hủy</button>
          <button type="submit" className="btn btn-sm" disabled={busy}>{busy ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo lớp'}</button>
        </div>
      </form>
    </Modal>
  )
}

/* S2 đóng lớp — backend từ chối nếu còn trẻ đang học (S2a), thông báo hiện ngay trong hộp thoại */
function CloseDialog({ cls, onClose, onSaved }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const run = async () => {
    setBusy(true); setErr('')
    try { await updateClass(cls.id, { status: 'CLOSED' }); onSaved(`Đã đóng ${cls.name}.`) }
    catch (e) { setErr(e.message); setBusy(false) }
  }
  return (
    <ConfirmDialog
      title="Đóng lớp"
      message={`Đóng ${cls.name} (${cls.academicYear})? Lớp đã đóng không nhận thêm trẻ hoặc phân công giáo viên mới.`}
      confirmLabel="Đóng lớp" danger busy={busy} error={err} onConfirm={run} onCancel={onClose}
    />
  )
}

/* S3 phân công / gỡ giáo viên: chọn nhiều giáo viên đang hoạt động, hệ thống tính phần thêm và phần gỡ */
function TeachersModal({ cls, onClose, onSaved }) {
  const { data, loading, error: loadError } = useFetch(() => lookupUsers({ role: 'TEACHER', status: 'ACTIVE', limit: 100 }), [])
  const current = new Set(cls.teacherUserIds ?? [])
  const [picked, setPicked] = useState(() => new Set(current))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const active = data?.items ?? []
  const activeIds = new Set(active.map((t) => t.id))
  // Giáo viên đang được phân công nhưng đã bị khóa: vẫn hiện để có thể gỡ
  const stale = (cls.teachers ?? []).filter((t) => !activeIds.has(t.userId))

  const toggle = (id) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toAdd = [...picked].filter((id) => !current.has(id))
  const toRemove = [...current].filter((id) => !picked.has(id))

  const save = async () => {
    setBusy(true); setErr('')
    try {
      if (toAdd.length) await assignTeachers(cls.id, toAdd)
      for (const id of toRemove) await removeTeacher(cls.id, id)
      onSaved(`Đã cập nhật phân công cho ${cls.name}.`)
    } catch (e) { setErr(e.message); setBusy(false) }
  }

  return (
    <Modal title={`Phân công giáo viên: ${cls.name}`} onClose={onClose}>
      {err && <div className="alert" role="alert">{err}</div>}
      {loadError && <div className="alert" role="alert">{loadError}</div>}
      {loading && <p className="muted">Đang tải danh sách giáo viên...</p>}
      <fieldset className="plain">
        <legend className="muted">Chọn giáo viên phụ trách lớp</legend>
        <ul className="check-list">
          {stale.map((t) => (
            <li key={t.userId}>
              <label><input type="checkbox" checked={picked.has(t.userId)} onChange={() => toggle(t.userId)} />
                {t.fullName} <span className="badge locked">{USER_STATUS.LOCKED}</span></label>
            </li>
          ))}
          {active.map((t) => (
            <li key={t.id}>
              <label><input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} />
                <span>{t.fullName}<br /><span className="muted">{t.email}</span></span></label>
            </li>
          ))}
          {!loading && active.length === 0 && <li className="muted">Chưa có giáo viên đang hoạt động. Nhờ Admin tạo tài khoản giáo viên.</li>}
        </ul>
      </fieldset>
      <p className="muted spaced">{toAdd.length} thêm, {toRemove.length} gỡ</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} disabled={busy}>Hủy</button>
        <button type="button" className="btn btn-sm" onClick={save} disabled={busy || (!toAdd.length && !toRemove.length)}>
          {busy ? 'Đang lưu...' : 'Lưu phân công'}
        </button>
      </div>
    </Modal>
  )
}
