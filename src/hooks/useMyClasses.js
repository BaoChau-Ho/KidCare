import useFetch from './useFetch.js'
import { listClasses } from '../services/classes.js'

// Các lớp đang hoạt động mà người dùng hiện tại được phép thao tác
// (Giáo viên: lớp được phân công; Quản lý: tất cả)
export default function useMyClasses() {
  const { data, loading, error } = useFetch(() => listClasses({ status: 'ACTIVE', limit: 100 }), [])
  return { classes: data?.items ?? [], loading, error }
}
