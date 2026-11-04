import { api, USE_MOCK } from './http.js'

// UC-10 — Hoạt động
export const listActivities = (query) => api('GET', '/activities', { query })
export const createActivity = (body) => api('POST', '/activities', { body })
export const addParticipants = (id, childIds) => api('POST', `/activities/${id}/participants`, { body: { participants: childIds.map((childId) => ({ childId, participationStatus: 'JOINED' })) } })
// Mock nhận JSON (data URL đã thu nhỏ); backend thật nhận multipart/form-data với trường "file" theo openapi.yaml
export const uploadImage = async (id, img) => {
  if (USE_MOCK) return api('POST', `/activities/${id}/images`, { body: img })
  const form = new FormData()
  form.append('file', await (await fetch(img.dataUrl)).blob(), img.name)
  return api('POST', `/activities/${id}/images`, { body: form })
}
export const listChildActivities = (childId, query) => api('GET', `/children/${childId}/activities`, { query })
