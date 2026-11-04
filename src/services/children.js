import { api } from './http.js'

// UC-04 — Quản lý hồ sơ trẻ
export const listChildren = (query) => api('GET', '/children', { query })
export const getChild = (id) => api('GET', `/children/${id}`)
export const createChild = (body) => api('POST', '/children', { body })
export const updateChild = (id, body) => api('PATCH', `/children/${id}`, { body })
export const linkParent = (id, body) => api('POST', `/children/${id}/parents`, { body })
