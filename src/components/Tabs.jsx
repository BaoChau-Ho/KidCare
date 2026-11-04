// Thanh tab dùng chung: tabs = [{ key, label, disabled?, title? }]
export default function Tabs({ tabs, value, onChange, label = 'Chọn mục' }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.key} className="tab" role="tab" aria-selected={value === t.key} disabled={t.disabled} title={t.title} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}
