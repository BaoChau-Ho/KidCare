// Chọn nhanh một trong các con (phụ huynh có thể có nhiều con)
export default function ChildPills({ children, value, onChange }) {
  if (children.length <= 1) return null
  return (
    <div className="pills" role="tablist" aria-label="Chọn con">
      {children.map((c) => (
        <button key={c.id} role="tab" className="pill" aria-selected={value === c.id} onClick={() => onChange(c.id)}>
          {c.name}{c.className ? <span className="muted"> &middot; {c.className}</span> : null}
        </button>
      ))}
    </div>
  )
}
