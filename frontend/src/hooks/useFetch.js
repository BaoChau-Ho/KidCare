import { useCallback, useEffect, useRef, useState } from 'react'

// Gọi API khi deps đổi; giữ dữ liệu cũ khi đang tải lại để bảng không nháy.
export default function useFetch(fn, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: '' }))
    fnRef.current().then(
      (data) => alive && setState({ data, loading: false, error: '' }),
      (err) => alive && setState((s) => ({ ...s, loading: false, error: err.message })),
    )
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}
