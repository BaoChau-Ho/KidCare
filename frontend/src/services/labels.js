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
}
const FIELD_LABELS = {
  fullName: 'Họ tên', phone: 'SĐT', email: 'Email', role: 'Vai trò', status: 'Trạng thái',
  name: 'Tên', academicYear: 'Năm học', dateOfBirth: 'Ngày sinh', gender: 'Giới tính',
  address: 'Địa chỉ', class: 'Lớp', teacher: 'Giáo viên', parent: 'Phụ huynh', relationship: 'Quan hệ',
}

// Session cũ lưu role dạng chữ thường ('admin'); API dùng 'ADMIN'. Chuẩn hóa về dạng API.
export const normRole = (r) => String(r || '').toUpperCase().replace(/[\s-]/g, '_')

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