import {useEffect, useRef, useState } from 'react'

// Gọi API khi deps đổi; giữ dữ liệu cũ khi đang tải lại để bảng không nháy.
export default function useFetch(fn) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  }, [fn])

  useEffect(() => {
    let alive = true
    fnRef.current().then(
      (data) => { if (alive) setState({ data, loading: false, error: '' }) },
      (err) => { if (alive) setState((s) => ({ ...s, loading: false, error: err.message })) },
    )
    return () => { alive = false }
  }, [tick])

  const reload = () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    setTick((t) => t + 1)
  }
  return { ...state, reload }
}
