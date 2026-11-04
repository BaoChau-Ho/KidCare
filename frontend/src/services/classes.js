import { api } from './http.js'

// UC-05 — Quản lý lớp và phân công giáo viên
export const listClasses = (query) => api('GET', '/classes', { query })
export const getClass = (id) => api('GET', `/classes/${id}`)
export const createClass = (body) => api('POST', '/classes', { body })
export const updateClass = (id, body) => api('PATCH', `/classes/${id}`, { body })
export const assignTeachers = (id, teacherUserIds) => api('POST', `/classes/${id}/teachers`, { body: { teacherUserIds } })
export const removeTeacher = (id, teacherUserId) => api('DELETE', `/classes/${id}/teachers/${teacherUserId}`)
