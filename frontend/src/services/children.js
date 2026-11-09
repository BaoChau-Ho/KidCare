import { api } from './http.js'

// Backend trả parents[{ parentUserId, fullName, relationship }]; giao diện dùng userId. Chuẩn hóa một chỗ ở đây.
const withParents = (c) => (c.parents ? { ...c, parents: c.parents.map((p) => ({ userId: p.userId ?? p.parentUserId, fullName: p.fullName, relationship: p.relationship })) } : c)

// UC-04 — Quản lý hồ sơ trẻ
export const listChildren = async (query) => {
  const r = await api('GET', '/children', { query })
  return { ...r, items: r.items.map(withParents) }
}
export const getChild = async (id) => withParents(await api('GET', `/children/${id}`))
export const createChild = async (body) => withParents(await api('POST', '/children', { body }))
export const updateChild = async (id, body) => withParents(await api('PATCH', `/children/${id}`, { body }))
export const linkParent = (id, body) => api('POST', `/children/${id}/parents`, { body })
