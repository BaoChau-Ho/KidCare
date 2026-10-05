import { useEffect, useState } from 'react'

export default function Home() {
  const [status, setStatus] = useState('Đang kiểm tra...')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('Không kết nối được backend'))
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Trang chủ</h1>
      <p className="mt-2">Trạng thái backend: <strong>{status}</strong></p>
    </div>
  )
}