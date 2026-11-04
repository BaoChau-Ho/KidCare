import { useState } from 'react'
import AppShell from '../../components/AppShell.jsx'
import Field from '../../components/Field.jsx'
import Select from '../../components/Select.jsx'
import Modal from '../../components/Modal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Pagination from '../../components/Pagination.jsx'
import PasswordRules from '../../components/PasswordRules.jsx'
import useFetch from '../../hooks/useFetch.js'
import useDebounce from '../../hooks/useDebounce.js'
import { getSession, PASSWORD_RULES } from '../../services/auth.js'
import { listUsers, createUser, updateUser, changeUserRole, changeUserStatus, listAuditLogs } from '../../services/users.js'
import { ROLE_LABELS, USER_STATUS, ACTION_LABELS, fmtDateTime, diffText } from '../../services/labels.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LIMIT = 10

// UC-03 — Quản lý tài khoản (Admin): danh sách có tìm kiếm/lọc/phân trang; S1 thêm, S2 sửa + gán vai trò, S3 khóa/mở khóa, S4 ngừng hoạt động
export default function UsersPage() {
  const me = getSession().user.email.toLowerCase()
  const [filters, setFilters] = useState({ query: '', role: '', status: '' })
  const [page, setPage] = useState(1)
  const query = useDebounce(filters.query)
  const { data, loading, error, reload } = useFetch(
    () => listUsers({ query: query.trim(), role: filters.role, status: filters.status, page, limit: LIMIT }),
    [query, filters.role, filters.status, page],
  )
  const [dialog, setDialog] = useState(null) // { type: 'create' | 'edit' | 'status', user, status }
  const [flash, setFlash] = useState('')

  const setFilter = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1) }
  const done = (msg) => { setDialog(null); setFlash(msg); reload() }
  const isSelf = (u) => u.email.toLowerCase() === me

  return (
    <AppShell title="Quản lý tài khoản">
      {flash && <div className="notice spaced" role="status">{flash}</div>}

      <div className="toolbar">
        <div className="grow">
          <input type="search" placeholder="Tìm theo tên, email hoặc số điện thoại" aria-label="Tìm tài khoản"
            value={filters.query} onChange={setFilter('query')} />
        </div>
        <Select aria-label="Lọc theo vai trò" value={filters.role} onChange={setFilter('role')}>
          <option value="">Mọi vai trò</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select aria-label="Lọc theo trạng thái" value={filters.status} onChange={setFilter('status')}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(USER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <button className="btn btn-sm toolbar-end" onClick={() => { setFlash(''); setDialog({ type: 'create' }) }}>Thêm tài khoản</button>
      </div>

      {error && <div className="alert spaced" role="alert">{error} <button className="link-btn" onClick={reload}>Thử lại</button></div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr>
          </thead>
          <tbody>
            {loading && !data && <tr><td colSpan="5" className="empty">Đang tải...</td></tr>}
            {data?.items.length === 0 && <tr><td colSpan="5" className="empty">Không có tài khoản nào khớp bộ lọc.</td></tr>}
            {data?.items.map((u) => (
              <tr key={u.id} className={u.status === 'ACTIVE' ? '' : 'row-off'}>
                <td>{u.fullName}{isSelf(u) && <span className="muted"> (bạn)</span>}<br /><span className="muted">{u.phone || 'Chưa có số điện thoại'}</span></td>
                <td>{u.email}</td>
                <td>{ROLE_LABELS[u.role]}</td>
                <td><span className={`badge ${u.status.toLowerCase()}`}>{USER_STATUS[u.status]}</span></td>
                <td>
                  <div className="actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => { setFlash(''); setDialog({ type: 'edit', user: u }) }}>Sửa</button>
                    {u.status === 'ACTIVE' && (
                      <button className="btn btn-sm btn-ghost" disabled={isSelf(u)} title={isSelf(u) ? 'Không thể khóa chính mình' : undefined}
                        onClick={() => { setFlash(''); setDialog({ type: 'status', user: u, status: 'LOCKED' }) }}>Khóa</button>
                    )}
                    {u.status === 'LOCKED' && (
                      <button className="btn btn-sm btn-ghost" onClick={() => { setFlash(''); setDialog({ type: 'status', user: u, status: 'ACTIVE' }) }}>Mở khóa</button>
                    )}
                    {u.status === 'INACTIVE' && (
                      <button className="btn btn-sm btn-ghost" onClick={() => { setFlash(''); setDialog({ type: 'status', user: u, status: 'ACTIVE' }) }}>Kích hoạt lại</button>
                    )}
                    {u.status !== 'INACTIVE' && (
                      <button className="btn btn-sm btn-danger" disabled={isSelf(u)} title={isSelf(u) ? 'Không thể xóa chính mình' : undefined}
                        onClick={() => { setFlash(''); setDialog({ type: 'status', user: u, status: 'INACTIVE' }) }}>Xóa</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pageInfo={data?.pageInfo} onChange={setPage} />

      <AuditPanel refreshKey={flash} />

      {(dialog?.type === 'create' || dialog?.type === 'edit') && (
        <UserFormModal user={dialog.user} isSelf={dialog.user && isSelf(dialog.user)} onClose={() => setDialog(null)} onSaved={done} />
      )}
      {dialog?.type === 'status' && <StatusDialog dialog={dialog} onClose={() => setDialog(null)} onSaved={done} />}
    </AppShell>
  )
}

/* S1 thêm tài khoản / S2 sửa thông tin + gán vai trò */
function UserFormModal({ user, isSelf, onClose, onSaved }) {
  const editing = !!user
  const [form, setForm] = useState({
    fullName: user?.fullName ?? '', email: user?.email ?? '', phone: user?.phone ?? '', password: '', role: user?.role ?? 'TEACHER',
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const a11y = (k) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${k}-err` : undefined })

  const validate = () => {
    const errs = {}
    if (!form.fullName.trim()) errs.fullName = 'Nhập họ tên'
    if (!editing) {
      if (!form.email.trim()) errs.email = 'Nhập email'
      else if (!EMAIL_RE.test(form.email.trim())) errs.email = 'Email không hợp lệ'
      if (!PASSWORD_RULES.every((r) => r.test(form.password))) errs.password = 'Mật khẩu chưa đạt các yêu cầu bên dưới'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!validate()) return
    setBusy(true)
    try {
      if (editing) {
        const name = form.fullName.trim(), phone = form.phone.trim() || null
        if (name !== user.fullName || phone !== (user.phone || null)) await updateUser(user.id, { fullName: name, phone })
        if (form.role !== user.role) await changeUserRole(user.id, form.role)
        onSaved('Đã cập nhật tài khoản.')
      } else {
        await createUser({
          fullName: form.fullName.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined,
          temporaryPassword: form.password, role: form.role,
        })
        onSaved(`Đã tạo tài khoản ${form.email.trim()}.`)
      }
    } catch (err) {
      // S1a: email đã tồn tại -> báo ngay dưới ô email
      const key = err.field === 'temporaryPassword' ? 'password' : err.field || (err.status === 409 && !editing ? 'email' : null)
      if (key) setErrors({ [key]: err.message })
      else setFormError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={editing ? 'Sửa tài khoản' : 'Thêm tài khoản'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {formError && <div className="alert" role="alert">{formError}</div>}
        <Field id="fullName" label="Họ tên" error={errors.fullName}>
          <input id="fullName" value={form.fullName} onChange={set('fullName')} maxLength={150} {...a11y('fullName')} />
        </Field>
        <Field id="email" label="Email" error={errors.email} hint={editing ? 'Không thể đổi email.' : undefined}>
          <input id="email" type="email" autoComplete="off" value={form.email} onChange={set('email')} disabled={editing} {...a11y('email')} />
        </Field>
        <Field id="phone" label="Số điện thoại (không bắt buộc)">
          <input id="phone" type="tel" value={form.phone} onChange={set('phone')} maxLength={30} />
        </Field>
        {!editing && (
          <>
            <Field id="password" label="Mật khẩu tạm thời" error={errors.password}>
              <input id="password" type="text" autoComplete="new-password" value={form.password} onChange={set('password')} {...a11y('password')} />
            </Field>
            <PasswordRules password={form.password} />
          </>
        )}
        <Field id="role" label="Vai trò" hint={isSelf ? 'Bạn không thể đổi vai trò của chính mình.' : undefined}>
          <Select id="role" value={form.role} onChange={set('role')} disabled={isSelf}>
            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} disabled={busy}>Hủy</button>
          <button type="submit" className="btn btn-sm" disabled={busy}>{busy ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}</button>
        </div>
      </form>
    </Modal>
  )
}

/* S3 khóa/mở khóa, S4 ngừng hoạt động (xóa mềm) — luôn hỏi xác nhận */
const STATUS_TEXT = {
  LOCKED: (n) => ({ title: 'Khóa tài khoản', msg: `Khóa tài khoản của ${n}? Người này sẽ không đăng nhập được cho đến khi bạn mở khóa.`, ok: 'Khóa tài khoản', danger: true, done: 'Đã khóa tài khoản.' }),
  ACTIVE: (n) => ({ title: 'Mở khóa tài khoản', msg: `Cho phép ${n} đăng nhập trở lại?`, ok: 'Mở khóa', danger: false, done: 'Đã mở khóa tài khoản.' }),
  INACTIVE: (n) => ({ title: 'Xóa tài khoản', msg: `Xóa tài khoản của ${n}? Tài khoản chuyển sang "Ngừng hoạt động" và được giữ lại để bảo toàn lịch sử, không bị xóa vĩnh viễn.`, ok: 'Xóa tài khoản', danger: true, done: 'Đã chuyển tài khoản sang ngừng hoạt động.' }),
}
function StatusDialog({ dialog, onClose, onSaved }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const t = STATUS_TEXT[dialog.status](dialog.user.fullName)
  const run = async () => {
    setBusy(true); setErr('')
    try { await changeUserStatus(dialog.user.id, dialog.status); onSaved(t.done) }
    catch (e) { setErr(e.message); setBusy(false) }
  }
  return <ConfirmDialog title={t.title} message={t.msg} confirmLabel={t.ok} danger={t.danger} busy={busy} error={err} onConfirm={run} onCancel={onClose} />
}

/* Nhật ký thao tác quản trị */
function AuditPanel({ refreshKey }) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const { data, loading, error } = useFetch(() => (open ? listAuditLogs({ page, limit: 8 }) : Promise.resolve(null)), [open, page, refreshKey])
  return (
    <section>
      <h2>Nhật ký thao tác <button className="link-btn" onClick={() => setOpen((v) => !v)}>{open ? 'Ẩn' : 'Xem'}</button></h2>
      {open && (
        <>
          {error && <div className="alert" role="alert">{error}</div>}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Thời điểm</th><th>Người thao tác</th><th>Hành động</th><th>Đối tượng</th><th>Thay đổi</th></tr></thead>
              <tbody>
                {loading && !data && <tr><td colSpan="5" className="empty">Đang tải...</td></tr>}
                {data?.items.length === 0 && <tr><td colSpan="5" className="empty">Chưa có thao tác nào được ghi.</td></tr>}
                {data?.items.map((l) => (
                  <tr key={l.id}>
                    <td>{fmtDateTime(l.at)}</td>
                    <td>{l.actorEmail}</td>
                    <td>{ACTION_LABELS[l.action] ?? l.action}</td>
                    <td>{l.label}</td>
                    <td className="muted">{diffText(l.before, l.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pageInfo={data?.pageInfo} onChange={setPage} />
        </>
      )}
    </section>
  )
}
