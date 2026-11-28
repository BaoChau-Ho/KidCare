import { useEffect } from 'react'

export default function useNotificationTargetHighlight(id, items) {
  useEffect(() => {
    if (!id || !items?.some((item) => item.id === id)) return
    const target = [...document.querySelectorAll('[data-notification-target]')]
      .find((element) => element.getAttribute('data-notification-target') === id)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.classList.add('notification-target-highlight')
    const timer = window.setTimeout(() => target.classList.remove('notification-target-highlight'), 2600)
    return () => window.clearTimeout(timer)
  }, [id, items])
}
