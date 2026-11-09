import { useCallback, useEffect, useRef, useState } from 'react'

// Gọi API khi deps đổi; giữ dữ liệu cũ khi đang tải lại để bảng không nháy.
// deps chỉ chứa giá trị đơn giản (id, trang, ngày, bộ lọc) vì được ghép thành khóa bằng JSON.stringify.
export default function useFetch(fn, deps = []) {
  const [tick, setTick] = useState(0)
  const key = JSON.stringify([...deps, tick])
  // key: khóa của lần tải gần nhất đã xong. Khác khóa hiện tại nghĩa là đang tải.
  const [state, setState] = useState({ key: null, data: null, error: '' })
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  }, [fn])

  useEffect(() => {
    let alive = true
    fnRef.current().then(
      (data) => { if (alive) setState({ key, data, error: '' }) },
      (err) => { if (alive) setState((s) => ({ key, data: s.data, error: err.message })) },
    )
    return () => { alive = false }
  }, [key])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  const loading = state.key !== key
  return { data: state.data, loading, error: loading ? '' : state.error, reload }
}
