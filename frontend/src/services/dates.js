// Tiện ích ngày/giờ theo giờ địa phương (không dùng toISOString cho ngày để tránh lệch múi giờ)
export const pad = (n) => String(n).padStart(2, '0')
export const fmtLocalDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayStr = () => fmtLocalDate(new Date())
export const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s))
export const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || '')
export const addDays = (s, n) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + n); return fmtLocalDate(d) }
export const isWeekend = (s) => [0, 6].includes(new Date(`${s}T00:00:00`).getDay())
export const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000)
// date-time từ API: có thể là ISO 8601 có múi giờ (…Z, …+07:00) hoặc dạng 'YYYY-MM-DDTHH:mm' không múi giờ (mock).
// Luôn đổi về giờ địa phương của máy khi hiển thị.
const HAS_TZ = /T.*(Z|[+-]\d{2}:?\d{2})$/i
export const toLocalParts = (s) => {
  if (!s) return null
  const str = String(s)
  if (HAS_TZ.test(str)) {
    const d = new Date(str)
    return { date: fmtLocalDate(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
  }
  return { date: str.slice(0, 10), time: str.slice(11, 16) }
}
export const hhmm = (s) => toLocalParts(s)?.time ?? ''
// Gửi lên API: ghép ngày + giờ địa phương thành ISO 8601 kèm offset, ví dụ 2026-11-04T08:05:00+07:00
export const localIso = (date, time) => {
  const off = -new Date(`${date}T${time}`).getTimezoneOffset()
  const a = Math.abs(off)
  return `${date}T${time}:00${off >= 0 ? '+' : '-'}${pad(Math.floor(a / 60))}:${pad(a % 60)}`
}
