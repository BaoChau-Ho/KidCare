import { api } from './http.js'

// UC-06 / UC-07 — Điểm danh
export const getRoster = (classId, date) => api('GET', `/classes/${classId}/attendance`, { query: { date } })
export const checkIn = (body) => api('POST', '/attendance/check-in', { body })
export const checkOut = (body) => api('POST', '/attendance/check-out', { body })
export const updateAttendance = (id, body) => api('PATCH', `/attendance/${id}`, { body })
export const getChildToday = (childId) => api('GET', `/children/${childId}/attendance/today`)
export const listChildAttendance = (childId, query) => api('GET', `/children/${childId}/attendance`, { query })
