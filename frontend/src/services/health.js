import { api } from './http.js'

// UC-09 — Hồ sơ sức khỏe
export const getHealthSummary = (childId) => api('GET', `/children/${childId}/health-summary`)
export const getClassAlerts = (classId) => api('GET', `/classes/${classId}/health-alerts`)
export const listHealthRecords = (childId, query) => api('GET', `/children/${childId}/health-records`, { query })
export const createHealthRecord = (childId, body) => api('POST', `/children/${childId}/health-records`, { body })
export const updateHealthRecord = (id, body) => api('PATCH', `/health-records/${id}`, { body })
export const listAllergies = (childId) => api('GET', `/children/${childId}/allergies`)
export const createAllergy = (childId, body) => api('POST', `/children/${childId}/allergies`, { body })
export const updateAllergy = (id, body) => api('PATCH', `/allergies/${id}`, { body })
export const listConditions = (childId) => api('GET', `/children/${childId}/medical-conditions`)
export const createCondition = (childId, body) => api('POST', `/children/${childId}/medical-conditions`, { body })
export const updateCondition = (id, body) => api('PATCH', `/medical-conditions/${id}`, { body })
export const listVaccinations = (childId, query) => api('GET', `/children/${childId}/vaccinations`, { query })
export const createVaccination = (childId, body) => api('POST', `/children/${childId}/vaccinations`, { body })
export const listVisits = (childId, query) => api('GET', `/children/${childId}/medical-visits`, { query })
export const createVisit = (childId, body) => api('POST', `/children/${childId}/medical-visits`, { body })
