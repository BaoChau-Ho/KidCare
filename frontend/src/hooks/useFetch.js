import { useCallback, useEffect, useRef, useState } from 'react'

// Gọi API khi deps đổi; giữ dữ liệu cũ khi đang tải lại để bảng không nháy.
export default function useFetch(fn, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  useEffect(() => { fnRef.current = fn })

  // deps đổi thì bật loading ngay lúc render, không cần đợi effect
  const key = [...deps, tick]
  const [prevKey, setPrevKey] = useState(key)
  if (key.length !== prevKey.length || key.some((d, i) => !Object.is(d, prevKey[i]))) {
    setPrevKey(key)
    setState((s) => ({ ...s, loading: true, error: '' }))
  }

  useEffect(() => {
    let alive = true
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
