import { api } from './http.js'

// UC-11 / UC-12 — Đón trẻ
export const listPickups = (query) => api('GET', '/pickup-requests', { query })
export const createPickup = (body) => api('POST', '/pickup-requests', { body })
export const cancelPickup = (id) => api('PATCH', `/pickup-requests/${id}/cancel`, { body: {} })
export const approvePickup = (id) => api('PATCH', `/pickup-requests/${id}/approve`, { body: {} })
export const rejectPickup = (id, reason) => api('PATCH', `/pickup-requests/${id}/reject`, { body: { reason } })
export const completePickup = (id) => api('PATCH', `/pickup-requests/${id}/complete`, { body: {} })
