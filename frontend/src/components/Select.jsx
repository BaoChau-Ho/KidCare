import { Children, useEffect, useId, useRef, useState } from 'react'

const textOf = (node) => Children.toArray(node).join('')
const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')

// Ô chọn tự vẽ, dùng thay cho <select>. Cách dùng y hệt:
//   <Select id="role" value={v} onChange={(e) => setV(e.target.value)}>
//     <option value="A">Nhãn A</option> ...
//   </Select>
// Hỗ trợ bàn phím: mũi tên, Home/End, Enter/Space, Esc, gõ chữ cái đầu để nhảy tới mục.
export default function Select({ id, value, onChange, children, disabled, className = '', ...rest }) {
  const uid = useId()
  const listId = `${uid}-list`
  const root = useRef(null)
  const btn = useRef(null)
  const list = useRef(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [up, setUp] = useState(false)

  const options = Children.toArray(children)
    .filter((c) => c?.type === 'option')
    .map((c) => ({ value: String(c.props.value ?? textOf(c.props.children)), label: textOf(c.props.children), disabled: !!c.props.disabled }))
  const selectedIdx = options.findIndex((o) => o.value === String(value ?? ''))
  const current = options[selectedIdx] ?? options[0]

  const openList = () => {
    const r = root.current.getBoundingClientRect()
    const below = window.innerHeight - r.bottom
    setUp(below < 280 && r.top > below) // hết chỗ phía dưới thì mở lên trên
    setActive(selectedIdx >= 0 ? selectedIdx : options.findIndex((o) => !o.disabled))
    setOpen(true)
  }
  const choose = (i) => {
    const o = options[i]
    if (!o || o.disabled) return
    setOpen(false)
    btn.current?.focus()
    if (o.value !== String(value ?? '')) onChange?.({ target: { value: o.value } })
  }
  const step = (dir, from = active) => {
    let i = from
    do { i += dir } while (i >= 0 && i < options.length && options[i].disabled)
    return i >= 0 && i < options.length ? i : from
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!root.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const onKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown': case 'ArrowUp':
        e.preventDefault()
        if (!open) openList(); else setActive((a) => step(e.key === 'ArrowDown' ? 1 : -1, a))
        break
      case 'Home': case 'End':
        if (!open) break
        e.preventDefault()
        setActive(e.key === 'Home' ? step(1, -1) : step(-1, options.length))
        break
      case 'Enter': case ' ':
        e.preventDefault()
        if (!open) openList(); else choose(active)
        break
      case 'Escape':
        if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false) } // không đóng cả hộp thoại phía ngoài
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          const ch = fold(e.key)
          const start = open ? active : selectedIdx
          const i = [...options.keys()].map((_, k) => (start + 1 + k) % options.length).find((k) => !options[k].disabled && fold(options[k].label).startsWith(ch))
          if (i !== undefined) { if (open) setActive(i); else onChange?.({ target: { value: options[i].value } }) }
        }
    }
  }

  return (
    <div className={`select ${up ? 'up' : ''} ${className}`} ref={root}>
      <button
        type="button" id={id} ref={btn} className="select-btn" disabled={disabled}
        role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())} onKeyDown={onKeyDown} {...rest}
      >
        <span className="select-value">{current?.label}</span>
        <svg className="select-chevron" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="select-list" role="listbox" id={listId} ref={list} aria-label={rest['aria-label']}>
          {options.map((o, i) => (
            <li
              key={`${o.value}-${i}`} id={`${listId}-${i}`} role="option" aria-selected={i === selectedIdx}
              aria-disabled={o.disabled || undefined}
              className={`select-option ${i === active ? 'is-active' : ''}`}
              onMouseEnter={() => !o.disabled && setActive(i)}
              onMouseDown={(e) => e.preventDefault()} // giữ focus ở nút
              onClick={() => choose(i)}
            >
              <span>{o.label}</span>
              {i === selectedIdx && <span className="select-check" aria-hidden="true">{'\u2713'}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}