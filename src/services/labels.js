import { hhmm, toLocalParts } from './dates.js'
export const ROLE_LABELS = {
  ADMIN: 'Quản trị viên',
  MANAGER: 'Quản lý cơ sở',
  TEACHER: 'Giáo viên',
  MEDICAL_STAFF: 'Nhân viên y tế',
  PARENT: 'Phụ huynh',
}
export const USER_STATUS = { ACTIVE: 'Hoạt động', LOCKED: 'Đã khóa', INACTIVE: 'Ngừng hoạt động' }
export const CLASS_STATUS = { ACTIVE: 'Hoạt động', CLOSED: 'Đã đóng' }
export const CHILD_STATUS = { ACTIVE: 'Đang học', INACTIVE: 'Tạm nghỉ', WITHDRAWN: 'Đã nghỉ học' }
export const REQUEST_STATUS = { pending: 'Chờ duyệt', approved: 'Đã duyệt', active: 'Đã kích hoạt', rejected: 'Từ chối' }
export const GENDER = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' }
export const RELATIONSHIP = { FATHER: 'Bố', MOTHER: 'Mẹ', GUARDIAN: 'Người giám hộ' }

export const ACTION_LABELS = {
  CREATE_USER: 'Tạo tài khoản',
  UPDATE_USER: 'Sửa thông tin tài khoản',
  CHANGE_ROLE: 'Đổi vai trò',
  CHANGE_STATUS: 'Đổi trạng thái tài khoản',
  CREATE_CLASS: 'Tạo lớp',
  UPDATE_CLASS: 'Sửa lớp',
  CLOSE_CLASS: 'Đóng lớp',
  ASSIGN_TEACHER: 'Phân công giáo viên',
  REMOVE_TEACHER: 'Gỡ giáo viên',
  CREATE_CHILD: 'Tạo hồ sơ trẻ',
  UPDATE_CHILD: 'Sửa hồ sơ trẻ',
  LINK_PARENT: 'Liên kết phụ huynh',
  CHECK_IN: 'Check-in', CHECK_OUT: 'Check-out', MARK_ABSENT: 'Ghi vắng', UPDATE_ATTENDANCE: 'Sửa điểm danh',
  CREATE_LEAVE: 'Gửi đơn xin nghỉ', APPROVE_LEAVE: 'Duyệt đơn nghỉ', REJECT_LEAVE: 'Từ chối đơn nghỉ', CANCEL_LEAVE: 'Rút đơn nghỉ',
  CREATE_HEALTH: 'Ghi hồ sơ sức khỏe', UPDATE_HEALTH: 'Sửa hồ sơ sức khỏe',
  CREATE_ACTIVITY: 'Tạo hoạt động', UPLOAD_IMAGE: 'Tải ảnh hoạt động',
  CREATE_PICKUP: 'Đăng ký người đón', CANCEL_PICKUP: 'Hủy đăng ký đón', APPROVE_PICKUP: 'Duyệt người đón', REJECT_PICKUP: 'Từ chối người đón', COMPLETE_PICKUP: 'Giao trẻ',
  BROADCAST: 'Gửi thông báo',
}
const FIELD_LABELS = {
  fullName: 'Họ tên', phone: 'SĐT', email: 'Email', role: 'Vai trò', status: 'Trạng thái',
  name: 'Tên', academicYear: 'Năm học', dateOfBirth: 'Ngày sinh', gender: 'Giới tính',
  height: 'Chiều cao', weight: 'Cân nặng', temperature: 'Nhiệt độ', checkInTime: 'Giờ đến', checkOutTime: 'Giờ về', active: 'Đang theo dõi',
  recipients: 'Số người nhận', vaccine: 'Vắc-xin', visit: 'Lần khám', allergen: 'Tác nhân', person: 'Người đón', time: 'Thời gian', participants: 'Số trẻ tham gia', from: 'Từ ngày', to: 'Đến ngày',
  address: 'Địa chỉ', class: 'Lớp', teacher: 'Giáo viên', parent: 'Phụ huynh', relationship: 'Quan hệ',
}

// Session cũ lưu role dạng chữ thường ('admin'); API dùng 'ADMIN'. Chuẩn hóa về dạng API.
export const normRole = (r) => {
  const k = String(r || '').toUpperCase().replace(/[\s-]/g, '_')
  return k === 'MEDICAL' ? 'MEDICAL_STAFF' : k // ROLES.medical ở auth.js <-> MEDICAL_STAFF ở API
}

export const fmtDate = (d) => {
  if (!d) return '\u2014'
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : new Date(d).toLocaleDateString('vi-VN')
}
export const fmtDateTime = (d) => new Date(d).toLocaleString('vi-VN')

export const diffText = (before, after) => {
  if (!after) return ''
  return Object.keys(after)
    .map((k) => {
      const name = FIELD_LABELS[k] ?? k
      return before && k in before ? `${name}: ${before[k] ?? '\u2014'} \u2192 ${after[k] ?? '\u2014'}` : `${name}: ${after[k] ?? '\u2014'}`
    })
    .join('; ')
}

/* ---------- Stage 3-6 ---------- */
export const ATTENDANCE_STATUS = { NOT_CHECKED_IN: 'Chưa điểm danh', PRESENT: 'Có mặt', LATE: 'Đi muộn', ABSENT: 'Vắng', EARLY_LEAVE: 'Về sớm' }
export const LEAVE_STATUS = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', CANCELLED: 'Đã rút' }
export const PICKUP_STATUS = { PENDING: 'Chờ xác minh', APPROVED: 'Đã xác minh', REJECTED: 'Từ chối', COMPLETED: 'Đã giao trẻ', CANCELLED: 'Đã hủy' }
export const SEVERITY = { MILD: 'Nhẹ', MODERATE: 'Trung bình', SEVERE: 'Nặng' }
export const NOTI_TYPE = { ATTENDANCE: 'Điểm danh', LEAVE: 'Nghỉ học', HEALTH: 'Sức khỏe', ACTIVITY: 'Hoạt động', PICKUP: 'Đón trẻ', ANNOUNCEMENT: 'Thông báo từ lớp', SYSTEM: 'Hệ thống' }
export const PICKER_RELATIONS = ['Ông', 'Bà', 'Anh/Chị', 'Cô/Dì', 'Chú/Bác/Cậu', 'Người quen được ủy quyền', 'Khác']

// 'YYYY-MM-DDTHH:mm' -> 'HH:mm'; '—' nếu rỗng
export const fmtTime = (s) => hhmm(s) || '\u2014'
// 'YYYY-MM-DDTHH:mm' -> 'HH:mm dd/mm/yyyy'
export const fmtDT = (s) => { const p = toLocalParts(s); return p ? `${p.time} ${fmtDate(p.date)}` : '\u2014' }
// Tên hiển thị của chỉ số trong các ô số đo
export const fmtNum = (v, unit) => (v == null ? '\u2014' : `${String(v).replace('.', ',')} ${unit}`)
