import { api } from './http.js'

// UC-15 — Báo cáo (Quản lý cơ sở)
export const attendanceReport = (query) => api('GET', '/reports/attendance', { query })
export const classReport = (query) => api('GET', '/reports/classes', { query })
export const healthReport = (query) => api('GET', '/reports/health', { query })
