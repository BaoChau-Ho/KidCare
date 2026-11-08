import { useState } from 'react'
import AppShell from '../../components/AppShell.jsx'
import Field from '../../components/Field.jsx'
import Select from '../../components/Select.jsx'
import useFetch from '../../hooks/useFetch.js'
import useMyClasses from '../../hooks/useMyClasses.js'
import { listClassChildren } from '../../services/classes.js'
import { broadcast } from '../../services/notifications.js'

// UC-13 — Gửi thông báo cho phụ huynh cả lớp hoặc một nhóm trẻ
export default function NotifyPage() {
  const { classes, loading: loadingClasses } = useMyClasses()
  const [classId, setClassId] = useState('')
  const [audience, setAudience] = useState('all')
  const [picked, setPicked] = useState(() => new Set())
  const [form, setForm] = useState({ title: '', content: '' })
  const [errors, setErrors] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const cid = classId || classes[0]?.id || ''
  const { data: kids, loading: loadingKids } = useFetch(() => (cid ? listClassChildren(cid) : Promise.resolve(null)), [cid])
  const children = kids?.items ?? []
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const toggle = (id) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const a11y = (k) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${k}-err` : undefined })

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setResult(null)
    const errs = {}
    if (!form.title.trim()) errs.title = 'Nhập tiêu đề'
    if (!form.content.trim()) errs.content = 'Nhập nội dung'
    if (audience === 'some' && picked.size === 0) errs.audience = 'Chọn ít nhất một trẻ'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const r = await broadcast({ classId: cid, title: form.title.trim(), content: form.content.trim(), ...(audience === 'some' ? { childIds: [...picked] } : {}) })
      setResult(r)
      setForm({ title: '', content: '' }); setPicked(new Set()); setAudience('all')
    } catch (err2) {
      if (err2.field) setErrors({ [err2.field]: err2.message }); else setError(err2.message)
    } finally { setBusy(false) }
  }

  return (
    <AppShell title="Gửi thông báo cho phụ huynh">
      {!loadingClasses && classes.length === 0 && <div className="notice spaced">Bạn chưa được phân công lớp nào nên chưa thể gửi thông báo.</div>}
      <form className="panel spaced narrow" onSubmit={submit} noValidate>
        {result && <div className="notice" role="status">Đã gửi thông báo đến {result.recipientCount} phụ huynh.</div>}
        {error && <div className="alert" role="alert">{error}</div>}

        <Field id="class" label="Lớp">
          <Select id="class" value={cid} onChange={(e) => { setClassId(e.target.value); setPicked(new Set()) }} disabled={classes.length === 0}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.academicYear})</option>)}
          </Select>
        </Field>

        <fieldset className="plain">
          <legend>Gửi đến</legend>
          <div className="radio-row">
            <label><input type="radio" name="aud" checked={audience === 'all'} onChange={() => setAudience('all')} /> Phụ huynh cả lớp</label>
            <label><input type="radio" name="aud" checked={audience === 'some'} onChange={() => setAudience('some')} /> Chọn một số trẻ</label>
          </div>
          {audience === 'some' && (
            <>
              {loadingKids && <p className="muted">Đang tải danh sách trẻ...</p>}
              <ul className="check-list">
                {children.map((c) => (
                  <li key={c.id}><label><input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} /> {c.name}</label></li>
                ))}
                {!loadingKids && children.length === 0 && <li className="muted">Lớp chưa có trẻ đang học.</li>}
              </ul>
              {errors.audience && <span className="field-err">{errors.audience}</span>}
            </>
          )}
        </fieldset>

        <Field id="title" label="Tiêu đề" error={errors.title}>
          <input id="title" value={form.title} onChange={set('title')} maxLength={200} {...a11y('title')} />
        </Field>
        <Field id="content" label="Nội dung" error={errors.content} hint="Không nên ghi thông tin sức khỏe chi tiết của trẻ vào thông báo.">
          <textarea id="content" rows="5" value={form.content} onChange={set('content')} maxLength={5000} {...a11y('content')} />
        </Field>
        <div className="actions">
          <button className="btn btn-sm" type="submit" disabled={busy || !cid}>{busy ? 'Đang gửi...' : 'Gửi thông báo'}</button>
        </div>
      </form>
    </AppShell>
  )
}
