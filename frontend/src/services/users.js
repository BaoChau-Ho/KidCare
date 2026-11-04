import { api } from './http.js'

// UC-03 — Admin quản lý tài khoản
export const listUsers = (query) => api('GET', '/users', { query })
export const createUser = (body) => api('POST', '/users', { body })
export const updateUser = (id, body) => api('PATCH', `/users/${id}`, { body })
export const changeUserRole = (id, role) => api('PATCH', `/users/${id}/role`, { body: { role } })
export const changeUserStatus = (id, status) => api('PATCH', `/users/${id}/status`, { body: { status } })
export const listAuditLogs = (query) => api('GET', '/audit-logs', { query })

// UC-04/05: Quản lý cơ sở tra cứu giáo viên / phụ huynh (dùng chung GET /users, xem ghi chú API)
export const lookupUsers = (query) => api('GET', '/users', { query })
