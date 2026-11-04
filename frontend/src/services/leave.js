import { api } from './http.js'

// UC-08 — Đơn xin nghỉ học
export const listLeaveRequests = (query) => api('GET', '/leave-requests', { query })
export const createLeaveRequest = (body) => api('POST', '/leave-requests', { body })
export const approveLeave = (id) => api('POST', `/leave-requests/${id}/approve`, { body: {} })
export const rejectLeave = (id, reason) => api('POST', `/leave-requests/${id}/reject`, { body: { reason } })
export const cancelLeave = (id) => api('PATCH', `/leave-requests/${id}/cancel`, { body: {} })
