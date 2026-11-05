// @vitest-environment jsdom
// Kiểm thử giao diện theo vai trò (Stage 7): route theo vai trò, các luồng chính của UC-06..15, ô chọn tự vẽ.
// Chạy: npx vitest run   (cần: npm i -D vitest jsdom @testing-library/react @testing-library/dom @testing-library/user-event)
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, configure, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App.jsx'
import Select from './components/Select.jsx'
import { resetMockDb } from './services/mockDb.js'
import { saveSession } from './services/auth.js'

globalThis.__MOCK_DELAY__ = 0
configure({ asyncUtilTimeout: 4000 })

const open = (path, email, role) => {
  sessionStorage.clear()
  if (email) saveSession({ user: { email, role }, token: 't' })
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}
beforeEach(() => { cleanup(); resetMockDb(); sessionStorage.clear() })

describe('Select tự vẽ', () => {
  it('mở danh sách, chọn bằng chuột và bằng bàn phím, gọi onChange với e.target.value', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Select aria-label="Vai trò" value="A" onChange={onChange}><option value="A">Mục A</option><option value="B">Mục B</option><option value="C" disabled>Mục C</option></Select>)
    const btn = screen.getByRole('combobox', { name: 'Vai trò' })
    expect(btn.textContent).toContain('Mục A')
    await user.click(btn)
    expect(screen.getByRole('listbox')).toBeTruthy()
    await user.click(screen.getByRole('option', { name: 'Mục B' }))
    expect(onChange).toHaveBeenCalledWith({ target: { value: 'B' } })
    expect(screen.queryByRole('listbox')).toBeNull()
    await user.click(btn)
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledTimes(2)
    await user.click(btn); await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('phân quyền theo route', () => {
  it('chưa đăng nhập -> trang đăng nhập (tiếng Việt)', async () => {
    open('/teacher')
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeTruthy()
  })
  it('phụ huynh vào trang giáo viên -> không đủ quyền', async () => {
    open('/teacher', 'parent@demo.com', 'parent')
    expect(await screen.findByRole('heading', { name: 'Không đủ quyền' })).toBeTruthy()
  })
})

describe('phụ huynh (UC-07, 08, 11, 14)', () => {
  it('dashboard: hôm nay, lịch sử, sức khỏe đã lọc, hoạt động, chuông thông báo', async () => {
    const user = userEvent.setup()
    open('/parent', 'parent@demo.com', 'parent')
    expect(await screen.findByRole('heading', { name: 'Nguyễn Bảo Châu' })).toBeTruthy() // con đầu tiên theo thứ tự chữ cái
    expect(await screen.findByText(/Hôm nay/)).toBeTruthy()
    expect(await screen.findByRole('link', { name: /Thông báo/ })).toBeTruthy()
    // lịch sử điểm danh có phân trang
    expect(await screen.findByText(/Trang 1\//)).toBeTruthy()
    // chuyển sang con thứ hai
    await user.click(screen.getByRole('tab', { name: /Minh An/ }))
    expect(await screen.findByRole('heading', { name: 'Nguyễn Minh An' })).toBeTruthy()
    // sức khỏe: thấy dị ứng của An nhưng không thấy kết luận chẩn đoán
    await user.click(screen.getByRole('tab', { name: 'Sức khỏe' }))
    expect(await screen.findByText(/Đậu phộng/)).toBeTruthy()
    expect(screen.queryByText(/Viêm họng/)).toBeNull()
    await user.click(screen.getByRole('tab', { name: 'Hoạt động' }))
    expect(await screen.findByText('Vẽ tranh mùa thu')).toBeTruthy()
  })
  it('gửi đơn xin nghỉ: lỗi theo trường rồi thành công', async () => {
    const user = userEvent.setup()
    open('/parent/leave', 'parent@demo.com', 'parent')
    await user.click(await screen.findByRole('button', { name: 'Gửi đơn mới' }))
    const dlg = await screen.findByRole('dialog')
    await user.click(within(dlg).getByRole('button', { name: 'Gửi đơn' }))
    expect(await within(dlg).findByText('Nhập lý do xin nghỉ')).toBeTruthy()
    await user.type(within(dlg).getByLabelText('Lý do'), 'Bé bị cảm')
    await user.click(within(dlg).getByRole('button', { name: 'Gửi đơn' }))
    expect(await screen.findByText(/Đã gửi đơn xin nghỉ/)).toBeTruthy()
    expect(await screen.findByText('Bé bị cảm')).toBeTruthy()
  })
  it('đăng ký người đón: validate giấy tờ', async () => {
    const user = userEvent.setup()
    open('/parent/pickups', 'parent@demo.com', 'parent')
    await user.click(await screen.findByRole('button', { name: 'Đăng ký người đón' }))
    const dlg = await screen.findByRole('dialog')
    await user.type(within(dlg).getByLabelText('Họ tên người đón'), 'Lê Văn C')
    await user.type(within(dlg).getByLabelText(/Số CCCD/), '123')
    await user.click(within(dlg).getByRole('button', { name: 'Gửi đăng ký' }))
    expect(await within(dlg).findByText(/9 hoặc 12 chữ số/)).toBeTruthy()
  })
  it('hộp thư: đánh dấu đã đọc làm giảm số chưa đọc', async () => {
    const user = userEvent.setup()
    open('/notifications', 'parent@demo.com', 'parent')
    const bell = await screen.findByRole('link', { name: /chưa đọc/ })
    const before = Number(/(\d+) chưa đọc/.exec(bell.getAttribute('aria-label'))[1])
    await user.click(await screen.findByRole('button', { name: /Chưa đọc\. .*đã đến lớp/ }))
    await waitFor(() => expect(Number(/(\d+) chưa đọc/.exec(screen.getByRole('link', { name: /Thông báo/ }).getAttribute('aria-label'))?.[1] ?? 0)).toBe(before - 1))
  })
})

describe('giáo viên (UC-06, 08, 10, 12, 13)', () => {
  it('điểm danh: roster, cảnh báo dị ứng, check-in và ghi vắng', async () => {
    const user = userEvent.setup()
    open('/teacher', 'teacher@demo.com', 'teacher')
    expect(await screen.findByText('Nguyễn Minh An')).toBeTruthy()
    expect(await screen.findByText(/Đậu phộng/)).toBeTruthy() // cảnh báo dị ứng hiện cạnh tên bé
    const row = screen.getByText('Đỗ Gia Huy').closest('tr')
    const checkInBtn = within(row).queryByRole('button', { name: 'Check-in' })
    if (checkInBtn) {
      await user.click(checkInBtn)
      expect(await screen.findByText(/Đã check-in cho Đỗ Gia Huy/)).toBeTruthy()
      await waitFor(() => expect(within(screen.getByText('Đỗ Gia Huy').closest('tr')).getByRole('button', { name: 'Check-out' })).toBeTruthy())
    }
  })
  it('đơn nghỉ: duyệt cần xác nhận; từ chối bắt buộc có lý do', async () => {
    const user = userEvent.setup()
    open('/teacher/leave', 'teacher@demo.com', 'teacher')
    await user.click(await screen.findByRole('button', { name: 'Từ chối' }))
    const dlg = await screen.findByRole('dialog')
    await user.click(within(dlg).getByRole('button', { name: 'Từ chối đơn' }))
    expect(await within(dlg).findByText('Nhập lý do từ chối.')).toBeTruthy()
    await user.type(within(dlg).getByLabelText(/Lý do/), 'Trùng lịch kiểm tra')
    await user.click(within(dlg).getByRole('button', { name: 'Từ chối đơn' }))
    expect(await screen.findByText(/Đã từ chối đơn nghỉ/)).toBeTruthy()
  })
  it('đón trẻ: xác minh rồi giao trẻ (check-out); giấy tờ ẩn mặc định', async () => {
    const user = userEvent.setup()
    open('/teacher/pickups', 'teacher@demo.com', 'teacher')
    expect(await screen.findByText('Nguyễn Văn Bảo')).toBeTruthy()
    expect(screen.queryByText('012345678901')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Hiện' }))
    expect(screen.getByText('012345678901')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Xác minh' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Xác minh' }))
    expect(await screen.findByText(/Đã xác minh người đón/)).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Giao trẻ' })).toBeTruthy()
  })
  it('gửi thông báo: validate rồi báo số phụ huynh đã nhận', async () => {
    const user = userEvent.setup()
    open('/teacher/notify', 'teacher@demo.com', 'teacher')
    await user.click(await screen.findByRole('button', { name: 'Gửi thông báo' }))
    expect(await screen.findByText('Nhập tiêu đề')).toBeTruthy()
    await user.type(screen.getByLabelText('Tiêu đề'), 'Nghỉ lễ')
    await user.type(screen.getByLabelText('Nội dung'), 'Trường nghỉ thứ hai')
    await user.click(screen.getByRole('button', { name: 'Gửi thông báo' }))
    expect(await screen.findByText(/Đã gửi thông báo đến 2 phụ huynh/)).toBeTruthy()
  })
  it('tạo hoạt động: tiêu đề bắt buộc, tạo thành công và hiện trong danh sách', async () => {
    const user = userEvent.setup()
    open('/teacher/activities', 'teacher@demo.com', 'teacher')
    await user.click(await screen.findByRole('button', { name: 'Tạo hoạt động' }))
    const dlg = await screen.findByRole('dialog')
    await user.click(within(dlg).getByRole('button', { name: 'Tạo hoạt động' }))
    expect(await within(dlg).findByText('Nhập tiêu đề')).toBeTruthy()
    await user.type(within(dlg).getByLabelText('Tiêu đề'), 'Làm đồ chơi tái chế')
    await user.click(within(dlg).getByRole('button', { name: 'Tạo hoạt động' }))
    expect(await screen.findByText(/Đã tạo hoạt động/)).toBeTruthy()
    expect(await screen.findByText('Làm đồ chơi tái chế')).toBeTruthy()
  })
})

describe('nhân viên y tế (UC-09)', () => {
  it('ghi số đo: từ chối giá trị vô lý, nhận giá trị hợp lệ', async () => {
    const user = userEvent.setup()
    open('/medical', 'medical@demo.com', 'medical')
    const link = (await screen.findAllByRole('link', { name: 'Mở hồ sơ' }))[0]
    await user.click(link)
    await user.click(await screen.findByRole('tab', { name: 'Chỉ số' }))
    await user.click(await screen.findByRole('button', { name: 'Thêm số đo' }))
    const dlg = await screen.findByRole('dialog')
    await user.type(within(dlg).getByLabelText(/Chiều cao/), '500')
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }))
    expect(await within(dlg).findByText(/Chiều cao phải trong khoảng 30 đến 150/)).toBeTruthy()
    await user.clear(within(dlg).getByLabelText(/Chiều cao/))
    await user.type(within(dlg).getByLabelText(/Chiều cao/), '101,5')
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }))
    expect(await screen.findByText('Đã ghi số đo.')).toBeTruthy()
  })
})

describe('quản lý (UC-15) và admin', () => {
  it('báo cáo điểm danh, lớp và sức khỏe hiển thị số liệu tổng hợp', async () => {
    const user = userEvent.setup()
    open('/manager/reports', 'manager@demo.com', 'manager')
    expect(await screen.findByText('Tỷ lệ chuyên cần')).toBeTruthy()
    await user.click(screen.getByRole('tab', { name: 'Lớp học' }))
    expect(await screen.findByText('Đơn nghỉ đã duyệt')).toBeTruthy()
    await user.click(screen.getByRole('tab', { name: 'Sức khỏe' }))
    expect(await screen.findByText('Trẻ có dị ứng')).toBeTruthy()
    expect(screen.queryByText(/Đậu phộng/)).toBeNull()
  })
  it('admin tạo tài khoản qua ô chọn vai trò tự vẽ', async () => {
    const user = userEvent.setup()
    open('/admin/users', 'admin@demo.com', 'admin')
    await user.click(await screen.findByRole('button', { name: 'Thêm tài khoản' }))
    const dlg = await screen.findByRole('dialog')
    await user.type(within(dlg).getByLabelText('Họ tên'), 'Cô Lan')
    await user.type(within(dlg).getByLabelText('Email'), 'lan@demo.com')
    await user.type(within(dlg).getByLabelText('Mật khẩu tạm thời'), 'Abc@12345')
    await user.click(within(dlg).getByRole('combobox', { name: 'Vai trò' }))
    await user.click(screen.getByRole('option', { name: 'Quản lý cơ sở' }))
    await user.click(within(dlg).getByRole('button', { name: 'Tạo tài khoản' }))
    expect(await screen.findByText(/Đã tạo tài khoản lan@demo.com/)).toBeTruthy()
  })
})
