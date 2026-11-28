import { useEffect } from 'react'
import { markRelatedRead } from '../services/notifications.js'

export default function useMarkRelatedNotificationsRead(relatedType, relatedIds, enabled = true) {
  const idsKey = JSON.stringify([...new Set((relatedIds ?? []).filter(Boolean))].sort())
  const typesKey = JSON.stringify(Array.isArray(relatedType) ? relatedType : [relatedType])

  useEffect(() => {
    if (!enabled) return
    const ids = JSON.parse(idsKey)
    const types = JSON.parse(typesKey)
    if (!ids.length) return

    let alive = true
    Promise.all(types.map((type) => markRelatedRead(type, ids)))
      .then(() => {
        if (alive) window.dispatchEvent(new Event('notifications:changed'))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [enabled, idsKey, typesKey])
}
