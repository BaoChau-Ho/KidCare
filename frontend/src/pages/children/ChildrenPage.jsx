import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AppShell from '../../components/AppShell.jsx'
import Field from '../../components/Field.jsx'
import Select from '../../components/Select.jsx'
import Modal from '../../components/Modal.jsx'
import Pagination from '../../components/Pagination.jsx'
import useFetch from '../../hooks/useFetch.js'
import useDebounce from '../../hooks/useDebounce.js'
import { listChildren, createChild } from '../../services/children.js'
import { listClasses } from '../../services/classes.js'
import { CHILD_STATUS, GENDER, fmtDate } from '../../services/labels.js'

const LIMIT = 10
const today = () => new Date().toISOString().slice(0, 10)

// UC-04 — Quản lý trẻ: danh sách có tìm kiếm theo tên, lọc theo lớp/trạng thái, phân trang; S1 thêm trẻ
export default function ChildrenPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [filters, setFilters] = useState({ query: '', classId: params.get('classId') || '', status: '' })
  const [page, setPage] = useState(1)
  const query = useDebounce(filters.query)
  const { data, loading, error, reload } = useFetch(
    () => listChildren({ query: query.trim(), classId: filters.classId, status: filters.status, page, limit: LIMIT }),
    [query, filters.classId, filters.status, page],
  )
  const { data: classPage } = useFetch(() => listClasses({ limit: 100 }), [])
  const classes = classPage?.items ?? []
  const [creating, setCreating] = useState(false)

  const setFilter = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1) }

  return (
    <AppShell title="Quản lý trẻ">
      <div className="toolbar">
        <div className="grow">
          <input type="search" placeholder="Tìm theo tên trẻ" aria-label="Tìm trẻ" value={filters.query} onChange={setFilter('query')} />
        </div>
        <Select aria-label="Lọc theo lớp" value={filters.classId} onChange={setFilter('classId')}>
          <option value="">Mọi lớp</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.academicYear})</option>)}
        </Select>
        <Select aria-label="Lọc theo trạng thái" value={filters.status} onChange={setFilter('status')}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(CHILD_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <button className="btn btn-sm toolbar-end" onClick={() => setCreating(true)}>Thêm trẻ</button>
      </div>

      {error && <div className="alert spaced" role="alert">{error} <button className="link-btn" onClick={reload}>Thử lại</button></div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Họ tên</th><th>Giới tính</th><th>Lớp</th><th>Trạng thái</th><th>Thao tác</th></tr>
          </thead>
          <tbody>
            {loading && !data && <tr><td colSpan="5" className="empty">Đang tải...</td></tr>}
            {data?.items.length === 0 && <tr><td colSpan="5" className="empty">Không có hồ sơ trẻ nào khớp bộ lọc.</td></tr>}
            {data?.items.map((c) => (
              <tr key={c.id} className={c.status === 'ACTIVE' ? '' : 'row-off'}>
                <td>{c.name}<br /><span className="muted">Sinh {fmtDate(c.dateOfBirth)}</span></td>
                <td>{GENDER[c.gender]}</td>
                <td>{c.className ?? <span className="muted">Chưa xếp lớp</span>}</td>
                <td><span className={`badge ${c.status.toLowerCase()}`}>{CHILD_STATUS[c.status]}</span></td>
                <td>
                  <Link className="btn btn-sm btn-ghost btn-link-inline" to={`/manager/children/${c.id}`}>Xem hồ sơ</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pageInfo={data?.pageInfo} onChange={setPage} />

      {creating && (
        <ChildFormModal
          classes={classes.filter((c) => c.status === 'ACTIVE')}
          onClose={() => setCreating(false)}
          onCreated={(child) => navigate(`/manager/children/${child.id}`, { state: { tab: 'parents', notice: `Đã tạo hồ sơ cho ${child.name}. Liên kết phụ huynh bên dưới.` } })}
        />
      )}
    </AppShell>
  )
}

/* S1 thêm trẻ: họ tên, ngày sinh, giới tính, địa chỉ, lớp đang hoạt động */
function ChildFormModal({ classes, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', dateOfBirth: '', gender: '', address: '', classId: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const a11y = (k) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${k}-err` : undefined })

  const submit = async (e) => {
    e.preventDefault()
    setFormError('')
    const errs = {}
    if (!form.name.trim()) errs.name = 'Nhập họ tên'
    if (!form.dateOfBirth) errs.dateOfBirth = 'Chọn ngày sinh'
    else if (form.dateOfBirth > today()) errs.dateOfBirth = 'Ngày sinh không được ở tương lai'
    if (!form.gender) errs.gender = 'Chọn giới tính'
    if (!form.classId) errs.classId = 'Chọn lớp'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const child = await createChild({
        name: form.name.trim(), dateOfBirth: form.dateOfBirth, gender: form.gender,
        address: form.address.trim() || undefined, classId: form.classId,
      })
      onCreated(child)
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message })
      else setFormError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Thêm trẻ" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {formError && <div className="alert" role="alert">{formError}</div>}
        <Field id="name" label="Họ tên" error={errors.name}>
          <input id="name" value={form.name} onChange={set('name')} maxLength={150} {...a11y('name')} />
        </Field>
        <div className="form-grid">
          <Field id="dateOfBirth" label="Ngày sinh" error={errors.dateOfBirth}>
            <input id="dateOfBirth" type="date" max={today()} value={form.dateOfBirth} onChange={set('dateOfBirth')} {...a11y('dateOfBirth')} />
          </Field>
          <Field id="gender" label="Giới tính" error={errors.gender}>
            <Select id="gender" value={form.gender} onChange={set('gender')} {...a11y('gender')}>
              <option value="">Chọn</option>
              {Object.entries(GENDER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
        </div>
        <Field id="address" label="Địa chỉ (không bắt buộc)">
          <input id="address" value={form.address} onChange={set('address')} maxLength={500} />
        </Field>
        <Field id="classId" label="Lớp" error={errors.classId} hint={classes.length === 0 ? 'Chưa có lớp đang hoạt động. Hãy tạo lớp trước.' : undefined}>
          <Select id="classId" value={form.classId} onChange={set('classId')} {...a11y('classId')}>
            <option value="">Chọn lớp</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.academicYear})</option>)}
          </Select>
        </Field>
        <p className="hint">Hồ sơ mới có trạng thái "Đang học". Sau khi tạo, bạn có thể liên kết phụ huynh.</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} disabled={busy}>Hủy</button>
          <button type="submit" className="btn btn-sm" disabled={busy}>{busy ? 'Đang lưu...' : 'Tạo hồ sơ'}</button>
        </div>
      </form>
    </Modal>
  )
}