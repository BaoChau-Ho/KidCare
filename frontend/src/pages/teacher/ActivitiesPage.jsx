import { useRef, useState } from 'react'
import AppShell from '../../components/AppShell.jsx'
import Field from '../../components/Field.jsx'
import Select from '../../components/Select.jsx'
import Modal from '../../components/Modal.jsx'
import Pagination from '../../components/Pagination.jsx'
import useFetch from '../../hooks/useFetch.js'
import useMyClasses from '../../hooks/useMyClasses.js'
import { listActivities, createActivity, uploadImage } from '../../services/activities.js'
import { listClassChildren } from '../../services/classes.js'
import { fmtDate } from '../../services/labels.js'
import { todayStr } from '../../services/dates.js'
import { prepareImage } from '../../utils/image.js'

const MAX_IMAGES = 6

// UC-10 — Hoạt động của lớp: tạo hoạt động, chọn trẻ tham gia, đính kèm ảnh
export default function ActivitiesPage() {
  const { classes } = useMyClasses()
  const [classId, setClassId] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useFetch(() => listActivities({ classId, page, limit: 6 }), [classId, page])
  const [creating, setCreating] = useState(false)
  const [flash, setFlash] = useState('')

  return (
    <AppShell title="Hoạt động của lớp">
      {flash && <div className="notice spaced" role="status">{flash}</div>}
      <div className="toolbar">
        <Select aria-label="Lọc theo lớp" value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1) }}>
          <option value="">Mọi lớp của tôi</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <button className="btn btn-sm toolbar-end" disabled={classes.length === 0} onClick={() => { setFlash(''); setCreating(true) }}>Tạo hoạt động</button>
      </div>
      {error && <div className="alert spaced" role="alert">{error} <button className="link-btn" onClick={reload}>Thử lại</button></div>}
      {loading && !data && <p className="muted spaced">Đang tải...</p>}
      {data?.items.length === 0 && <div className="panel spaced empty-panel">Chưa có hoạt động nào. Chọn "Tạo hoạt động" để ghi lại hoạt động đầu tiên của lớp.</div>}

      <div className="cards">
        {data?.items.map((a) => (
          <article key={a.id} className="card">
            <header>
              <h3>{a.title}</h3>
              <span className="muted">{a.className} &middot; {fmtDate(a.date)}</span>
            </header>
            {a.description && <p>{a.description}</p>}
            {a.images.length > 0 && (
              <div className="thumbs">{a.images.map((im) => <img key={im.id} src={im.url} alt={`Ảnh hoạt động ${a.title}`} loading="lazy" />)}</div>
            )}
            <p className="muted">Tham gia: {a.participants.length > 0 ? a.participants.map((p) => p.childName).join(', ') : 'chưa chọn trẻ'}</p>
          </article>
        ))}
      </div>
      <Pagination pageInfo={data?.pageInfo} onChange={setPage} />

      {creating && (
        <CreateModal classes={classes} defaultClass={classId || classes[0]?.id} onClose={() => setCreating(false)}
          onDone={(m) => { setCreating(false); setFlash(m); reload() }} />
      )}
    </AppShell>
  )
}

function CreateModal({ classes, defaultClass, onClose, onDone }) {
  const [cid, setCid] = useState(defaultClass || '')
  const [form, setForm] = useState({ title: '', description: '', date: todayStr() })
  const [picked, setPicked] = useState(null) // null = chọn tất cả
  const [files, setFiles] = useState([]) // [{ name, mime, size, dataUrl }]
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef(null)
  const { data: kids } = useFetch(() => listClassChildren(cid), [cid])
  const children = kids?.items ?? []
  const sel = picked ?? new Set(children.map((c) => c.id))
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const toggle = (id) => setPicked(() => { const n = new Set(sel); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const a11y = (k) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${k}-err` : undefined })

  const onFiles = async (e) => {
    const list = [...e.target.files]
    e.target.value = ''
    setErrors((x) => ({ ...x, image: '' }))
    const next = [...files]
    for (const f of list) {
      if (next.length >= MAX_IMAGES) { setErrors((x) => ({ ...x, image: `Tối đa ${MAX_IMAGES} ảnh cho mỗi hoạt động.` })); break }
      try { next.push(await prepareImage(f)) } catch (err) { setErrors((x) => ({ ...x, image: err.message })) }
    }
    setFiles(next)
  }

  const submit = async (e) => {
    e.preventDefault()
    setFormError('')
    const errs = {}
    if (!cid) errs.classId = 'Chọn lớp'
    if (!form.title.trim()) errs.title = 'Nhập tiêu đề'
    if (!form.date) errs.date = 'Chọn ngày'
    else if (form.date > todayStr()) errs.date = 'Chỉ ghi nhận hoạt động đã hoặc đang diễn ra'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    let created
    try {
      created = await createActivity({ classId: cid, title: form.title.trim(), description: form.description.trim() || undefined, date: form.date, participants: [...sel].map((childId) => ({ childId, participationStatus: 'JOINED' })) })
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message }); else setFormError(err.message)
      setBusy(false); return
    }
    // Hoạt động đã lưu; ảnh tải lên sau, lỗi ảnh không làm mất hoạt động
    const failed = []
    for (const f of files) {
      try { await uploadImage(created.id, f) } catch (err) { failed.push(`${f.name}: ${err.message}`) }
    }
    onDone(failed.length ? `Đã tạo hoạt động nhưng ${failed.length} ảnh chưa tải được (${failed.join('; ')}).` : `Đã tạo hoạt động "${created.title}" và thông báo cho phụ huynh.`)
  }

  return (
    <Modal title="Tạo hoạt động" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {formError && <div className="alert" role="alert">{formError}</div>}
        <Field id="classId" label="Lớp" error={errors.classId}>
          <Select id="classId" value={cid} onChange={(e) => { setCid(e.target.value); setPicked(null) }}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.academicYear})</option>)}
          </Select>
        </Field>
        <Field id="title" label="Tiêu đề" error={errors.title}>
          <input id="title" value={form.title} onChange={set('title')} maxLength={200} {...a11y('title')} />
        </Field>
        <Field id="date" label="Ngày" error={errors.date}>
          <input id="date" type="date" max={todayStr()} value={form.date} onChange={set('date')} {...a11y('date')} />
        </Field>
        <Field id="description" label="Mô tả (không bắt buộc)">
          <textarea id="description" rows="3" value={form.description} onChange={set('description')} maxLength={5000} />
        </Field>

        <fieldset className="plain">
          <legend>Trẻ tham gia ({sel.size}/{children.length})</legend>
          <ul className="check-list short">
            {children.map((c) => <li key={c.id}><label><input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} /> {c.name}</label></li>)}
            {kids && children.length === 0 && <li className="muted">Lớp chưa có trẻ đang học.</li>}
          </ul>
        </fieldset>

        <Field id="image" label={`Ảnh (tối đa ${MAX_IMAGES}, JPG/PNG/WEBP, mỗi ảnh ≤ 2 MB)`} error={errors.image}>
          <input id="image" ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFiles} />
        </Field>
        {files.length > 0 && (
          <div className="thumbs small">
            {files.map((f, i) => (
              <div key={i} className="thumb">
                <img src={f.dataUrl} alt={f.name} />
                <button type="button" className="thumb-x" aria-label={`Bỏ ảnh ${f.name}`} onClick={() => setFiles((l) => l.filter((_, j) => j !== i))}>&times;</button>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} disabled={busy}>Hủy</button>
          <button type="submit" className="btn btn-sm" disabled={busy}>{busy ? 'Đang lưu...' : 'Tạo hoạt động'}</button>
        </div>
      </form>
    </Modal>
  )
}
