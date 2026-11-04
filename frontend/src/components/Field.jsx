// Một ô nhập: nhãn + control + gợi ý/lỗi. Control tự gắn id, aria-invalid, aria-describedby.
export default function Field({ id, label, error, hint, className = '', children }) {
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <span className="muted">{hint}</span>}
      {error && <span id={`${id}-err`} className="field-err">{error}</span>}
    </div>
  )
}
