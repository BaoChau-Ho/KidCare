import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import About from './pages/About'

export default function App() {
  return (
    <BrowserRouter>
      <nav className="flex gap-4 bg-gray-100 p-4">
        <Link to="/" className="text-blue-600 hover:underline">Trang chủ</Link>
        <Link to="/about" className="text-blue-600 hover:underline">Giới thiệu</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </BrowserRouter>
  )
}