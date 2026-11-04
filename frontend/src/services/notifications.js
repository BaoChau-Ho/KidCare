import { api } from './http.js'

// UC-13 / UC-14 — Thông báo (người nhận luôn lấy từ phiên đăng nhập, client không gửi recipient)
export const listNotifications = (query) => api('GET', '/notifications', { query })
export const getUnreadCount = () => api('GET', '/notifications/unread-count')
export const markRead = (id) => api('PATCH', `/notifications/${id}/read`, { body: {} })
export const markAllRead = () => api('POST', '/notifications/read-all', { body: {} })
export const broadcast = (body) => api('POST', '/notifications/broadcast', { body })
