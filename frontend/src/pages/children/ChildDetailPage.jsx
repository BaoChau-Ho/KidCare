import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell.jsx'
import Field from '../../components/Field.jsx'
import Select from '../../components/Select.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import useFetch from '../../hooks/useFetch.js'
import { getChild, updateChild, linkParent } from '../../services/children.js'
import { listClasses } from '../../services/classes.js'
import { lookupUsers } from '../../services/users.js'
import { CHILD_STATUS, GENDER, RELATIONSHIP, fmtDate } from '../../services/labels.js'

const today = () => new Date().toISOString().slice(0, 10)
const FUTURE_TABS = ['Điểm danh', 'Sức khỏe', 'Hoạt động'] // chờ các Increment sau

// UC-04 — Hồ sơ một trẻ: tab Thông tin (S2 sửa/chuyển lớp, S4 đổi trạng thái) và tab Phụ huynh (S3 liên kết)
export default function ChildDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const { data: child, loading, error, reload } = useFetch(() => getChild(id), [id])
  const { data: classPage } = useFetch(() => listClasses({ limit: 100 }), [])
  const [tab, setTab] = useState(location.state?.tab ?? 'info')
  const [flash, setFlash] = useState(location.state?.notice ?? '')
  const saved = (msg) => { setFlash(msg); reload() }

  return (
    <AppShell title={child?.name ?? 'Hồ sơ trẻ'} sub={child ? `${CHILD_STATUS[child.status]}${child.className ? `, ${child.className}` : ''}` : undefined}>
      <p className="back-link"><Link to="/manager/children">Quay lại danh sách trẻ</Link></p>

      {/* IDOR/403/404: không có dữ liệu thì chỉ báo lỗi, không hiện gì của trẻ */}
      {error && !child && <div className="alert" role="alert">{error}</div>}
      {loading && !child && <p className="muted">Đang tải hồ sơ...</p>}

      {child && (
        <>
          <div className="tabs" role="tablist" aria-label="Hồ sơ trẻ">
            <button className="tab" role="tab" aria-selected={tab === 'info'} onClick={() => setTab('info')}>Thông tin</button>
            <button className="tab" role="tab" aria-selected={tab === 'parents'} onClick={() => setTab('parents')}>
              Phụ huynh ({child.parentUserIds?.length ?? 0})
            </button>
            {FUTURE_TABS.map((t) => <button key={t} className="tab" role="tab" disabled title="Sẽ có ở các bản sau">{t}</button>)}
          </div>
          {flash && <div className="notice" role="status">{flash}</div>}

          {tab === 'info' && <InfoTab child={child} classes={classPage?.items ?? []} onSaved={saved} onEdit={() => setFlash('')} />}
          {tab === 'parents' && <ParentsTab child={child} onLinked={saved} onEdit={() => setFlash('')} />}
        </>
      )}
    </AppShell>
  )
}

/* S2 cập nhật hồ sơ / chuyển lớp, S4 cho nghỉ học hoặc khôi phục */
function InfoTab({ child, classes, onSaved, onEdit }) {
  const [form, setForm] = useState({
    name: child.name, dateOfBirth: child.dateOfBirth, gender: child.gender, address: child.address ?? '', classId: child.classId ?? '',
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null) // { kind: 'class' | 'status', patch, message, ... }
  const [dialogError, setDialogError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const a11y = (k) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${k}-err` : undefined })

  // Lớp chọn được: lớp đang hoạt động + lớp hiện tại của trẻ (dù đã đóng)
  const options = classes.filter((c) => c.status === 'ACTIVE' || c.id === child.classId)
  const nameOf = (id) => classes.find((c) => c.id === id)?.name ?? 'lớp mới'

  const apply = async (patch, okMsg, fromDialog) => {
    setBusy(true); setFormError(''); setDialogError('')
    try {
      await updateChild(child.id, patch)
      setConfirm(null)
      onSaved(okMsg)
    } catch (err) {
      if (fromDialog) setDialogError(err.message)
      else if (err.field) setErrors({ [err.field]: err.message })
      else setFormError(err.message)
    } finally { setBusy(false) }
  }

  const submit = (e) => {
    e.preventDefault()
    onEdit()
    const errs = {}
    if (!form.name.trim()) errs.name = 'Nhập họ tên'
    if (!form.dateOfBirth) errs.dateOfBirth = 'Chọn ngày sinh'
    else if (form.dateOfBirth > today()) errs.dateOfBirth = 'Ngày sinh không được ở tương lai'
    if (!form.classId) errs.classId = 'Chọn lớp'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const patch = { name: form.name.trim(), dateOfBirth: form.dateOfBirth, gender: form.gender, address: form.address.trim() || null }
    if (form.classId !== child.classId) {
      patch.classId = form.classId
      setConfirm({ kind: 'class', patch, message: `Chuyển ${child.name} sang ${nameOf(form.classId)}? Giáo viên và phụ huynh sẽ thấy trẻ ở lớp mới.` })
    } else apply(patch, 'Đã cập nhật hồ sơ.')
  }

  const isActive = child.status === 'ACTIVE'

  return (
    <div className="panel">
      <form onSubmit={submit} noValidate>
        {formError && <div className="alert" role="alert">{formError}</div>}
        <div className="form-grid">
          <Field id="name" label="Họ tên" error={errors.name} className="full">
            <input id="name" value={form.name} onChange={set('name')} maxLength={150} {...a11y('name')} />
          </Field>
          <Field id="dateOfBirth" label="Ngày sinh" error={errors.dateOfBirth}>
            <input id="dateOfBirth" type="date" max={today()} value={form.dateOfBirth} onChange={set('dateOfBirth')} {...a11y('dateOfBirth')} />
          </Field>
          <Field id="gender" label="Giới tính">
            <Select id="gender" value={form.gender} onChange={set('gender')}>
              {Object.entries(GENDER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field id="address" label="Địa chỉ" className="full">
            <input id="address" value={form.address} onChange={set('address')} maxLength={500} />
          </Field>
          <Field id="classId" label="Lớp" error={errors.classId} className="full">
            <Select id="classId" value={form.classId} onChange={set('classId')} {...a11y('classId')}>
              {!form.classId && <option value="">Chọn lớp</option>}
              {options.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.academicYear}){c.status === 'CLOSED' ? ' - đã đóng' : ''}</option>)}
            </Select>
          </Field>
        </div>
        <div className="actions spaced">
          <button type="submit" className="btn btn-sm" disabled={busy}>{busy && !confirm ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
        </div>
      </form>

      <hr className="sep" />
      <h3 className="panel-title">Trạng thái học</h3>
      <p>
        <span className={`badge ${child.status.toLowerCase()}`}>{CHILD_STATUS[child.status]}</span>{' '}
        <span className="muted">Sinh {fmtDate(child.dateOfBirth)}. Hồ sơ không bị xóa; lịch sử điểm danh và sức khỏe luôn được giữ lại.</span>
      </p>
      {isActive ? (
        <button className="btn btn-sm btn-danger" onClick={() => { onEdit(); setDialogError(''); setConfirm({ kind: 'status', patch: { status: 'WITHDRAWN' }, message: `Cho ${child.name} nghỉ học? Hồ sơ chuyển sang "Đã nghỉ học" và vẫn được lưu để tra cứu.`, ok: 'Cho nghỉ học', done: 'Đã chuyển hồ sơ sang "Đã nghỉ học".', danger: true }) }}>
          Cho nghỉ học
        </button>
      ) : (
        <button className="btn btn-sm btn-ghost" onClick={() => { onEdit(); setDialogError(''); setConfirm({ kind: 'status', patch: { status: 'ACTIVE' }, message: `Khôi phục ${child.name} về trạng thái "Đang học"? Lớp hiện tại phải còn hoạt động.`, ok: 'Khôi phục', done: 'Đã khôi phục trạng thái "Đang học".' }) }}>
          Khôi phục đang học
        </button>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.kind === 'class' ? 'Chuyển lớp' : confirm.ok}
          message={confirm.message}
          confirmLabel={confirm.kind === 'class' ? 'Chuyển lớp' : confirm.ok}
          danger={confirm.danger}
          busy={busy} error={dialogError}
          onCancel={() => setConfirm(null)}
          onConfirm={() => apply(confirm.patch, confirm.kind === 'class' ? 'Đã cập nhật hồ sơ và chuyển lớp.' : confirm.done, true)}
        />
      )}
    </div>
  )
}

/* S3 liên kết phụ huynh: tìm theo email/số điện thoại, chọn quan hệ, không tạo liên kết trùng */
function ParentsTab({ child, onLinked, onEdit }) {
  const [q, setQ] = useState('')
  const [rel, setRel] = useState('MOTHER')
  const [results, setResults] = useState(null)
  const [searched, setSearched] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const linked = new Set(child.parentUserIds ?? [])

  const search = async (e) => {
    e.preventDefault()
    if (!q.trim()) return
    onEdit(); setErr(''); setBusy('search')
    try {
      const r = await lookupUsers({ query: q.trim(), role: 'PARENT', status: 'ACTIVE', limit: 10 })
      setResults(r.items); setSearched(q.trim())
    } catch (e2) { setErr(e2.message) } finally { setBusy('') }
  }
  const link = async (u) => {
    onEdit(); setErr(''); setBusy(u.id)
    try {
      await linkParent(child.id, { parentUserId: u.id, relationship: rel })
      setResults(null); setQ('')
      onLinked(`Đã liên kết ${u.fullName} (${RELATIONSHIP[rel]}) với ${child.name}.`)
    } catch (e2) { setErr(e2.message) } finally { setBusy('') }
  }

  return (
    <div className="panel">
      <h3 className="panel-title">Phụ huynh đã liên kết</h3>
      {child.parents ? (
        <div className="table-wrap flat">
          <table>
            <thead><tr><th>Họ tên</th><th>Quan hệ</th></tr></thead>
            <tbody>
              {child.parents.length === 0 && <tr><td colSpan="2" className="empty">Chưa liên kết phụ huynh nào.</td></tr>}
              {child.parents.map((p) => (
                <tr key={p.userId}><td>{p.fullName}</td><td>{RELATIONSHIP[p.relationship]}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="muted">{linked.size} phụ huynh đã liên kết.</p>}

      <hr className="sep" />
      <h3 className="panel-title">Liên kết phụ huynh mới</h3>
      {err && <div className="alert" role="alert">{err}</div>}
      <form className="inline-form" onSubmit={search}>
        <div className="grow">
          <input type="search" aria-label="Email hoặc số điện thoại phụ huynh" placeholder="Email hoặc số điện thoại phụ huynh" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn btn-sm" type="submit" disabled={busy === 'search' || !q.trim()}>{busy === 'search' ? 'Đang tìm...' : 'Tìm'}</button>
      </form>

      {results && (
        <>
          <Field id="relationship" label="Quan hệ với trẻ" className="spaced">
            <Select id="relationship" value={rel} onChange={(e) => setRel(e.target.value)}>
              {Object.entries(RELATIONSHIP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          {results.length === 0 && (
            <p className="muted">Không tìm thấy phụ huynh nào với "{searched}". Nhờ Admin tạo tài khoản phụ huynh rồi tìm lại.</p>
          )}
          <ul className="result-list">
            {results.map((u) => (
              <li key={u.id} className="result-row">
                <span>{u.fullName}<br /><span className="muted">{u.email}{u.phone ? `, ${u.phone}` : ''}</span></span>
                {linked.has(u.id)
                  ? <span className="muted">Đã liên kết</span>
                  : <button className="btn btn-sm" disabled={!!busy} onClick={() => link(u)}>{busy === u.id ? 'Đang liên kết...' : 'Liên kết'}</button>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
