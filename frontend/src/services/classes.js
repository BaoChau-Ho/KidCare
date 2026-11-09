import { api } from './http.js'

// Backend trả teachers[{ id, fullName, email }]; giao diện dùng userId. Chuẩn hóa một chỗ ở đây.
const withTeachers = (c) => ({ ...c, teachers: (c.teachers ?? []).map((t) => ({ userId: t.userId ?? t.id, fullName: t.fullName, email: t.email })) })

// UC-05 — Quản lý lớp và phân công giáo viên
export const listClasses = async (query) => {
  const r = await api('GET', '/classes', { query })
  return { ...r, items: r.items.map(withTeachers) }
}
export const getClass = async (id) => withTeachers(await api('GET', `/classes/${id}`))
export const createClass = async (body) => withTeachers(await api('POST', '/classes', { body }))
export const updateClass = async (id, body) => withTeachers(await api('PATCH', `/classes/${id}`, { body }))
export const assignTeachers = (id, teacherUserIds) => api('POST', `/classes/${id}/teachers`, { body: { teacherUserIds } })
export const removeTeacher = (id, teacherUserId) => api('DELETE', `/classes/${id}/teachers/${teacherUserId}`)
// Giáo viên liệt kê trẻ của lớp mình qua GET /children?classId= (backend Stage 2 đã lọc theo phân công)
export const listClassChildren = (id) => api('GET', '/children', { query: { classId: id, status: 'ACTIVE', limit: 100 } })
