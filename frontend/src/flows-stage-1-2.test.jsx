// @vitest-environment jsdom
// Kiểm thử giao diện giai đoạn 1–2 trên mock server (cùng cách với flows.test.jsx):
// đăng nhập, đăng ký + admin duyệt (UC-01, 02), quản lý tài khoản (UC-03), lớp (UC-05), hồ sơ trẻ (UC-04).
// Giao diện với dữ liệu đúng dạng backend thật: backendShape.test.jsx.
import { beforeEach, describe, expect, it } from 'vitest'
import { cleanup, configure, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App.jsx'
import { resetMockDb } from './services/mockDb.js'
import { saveSession } from './services/auth.js'

globalThis.__MOCK_DELAY__ = 0
configure({ asyncUtilTimeout: 4000 })

const open = (path, email, role) => {
  sessionStorage.clear()
  if (email) saveSession({ user: { email, role }, token: 't' })
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}
beforeEach(() => { cleanup(); localStorage.clear(); resetMockDb(); sessionStorage.clear() })

const pick = async (u, scope, combobox, option) => {
  await u.click(within(scope).getByRole('combobox', { name: combobox }))
  await u.click(screen.getByRole('option', { name: option }))
}
const rowOf = async (text) => (await screen.findByText(text)).closest('tr')

describe('đăng nhập (UC-01)', () => {
  const signIn = async (u, email, password) => {
    const emailInput = screen.getByLabelText('Email')
    const pwInput = screen.getByLabelText('Mật khẩu')
    await u.clear(emailInput)
    if (email) await u.type(emailInput, email)
    await u.clear(pwInput)
    if (password) await u.type(pwInput, password)
    await u.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  }

  it('UI-01 bỏ trống hoặc email sai định dạng → báo lỗi ngay dưới ô, không gửi', async () => {
    const u = userEvent.setup()
    open('/login')
    await signIn(u, '', '')
    expect(screen.getByText('Nhập email')).toBeTruthy()
    expect(screen.getByText('Nhập mật khẩu')).toBeTruthy()
    await signIn(u, 'abc', 'x')
    expect(screen.getByText('Email không hợp lệ')).toBeTruthy()
  })

  it('UI-02 đăng nhập đúng → về trang chủ của vai trò; sai mật khẩu → thông báo chung', async () => {
    const u = userEvent.setup()
    open('/login')
    await signIn(u, 'manager@demo.com', 'Sai@12345')
    expect((await screen.findByRole('alert')).textContent).toMatch(/Email hoặc mật khẩu không đúng/)
    await signIn(u, 'manager@demo.com', 'Password@123')
    expect(await screen.findByRole('heading', { name: 'Quản lý lớp' })).toBeTruthy()
  })

  it.each([
    ['pending@demo.com', /đang chờ admin duyệt/],
    ['disabled@demo.com', /bị quản trị viên khóa/],
  ])('UI-03 tài khoản %s → báo đúng lý do, không vào được', async (email, message) => {
    const u = userEvent.setup()
    open('/login')
    await signIn(u, email, 'Password@123')
    expect((await screen.findByRole('alert')).textContent).toMatch(message)
    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeTruthy()
  })

  it('UI-04 sai 5 lần liên tiếp → khóa 30 giây, lần thứ 6 không gửi yêu cầu', async () => {
    const u = userEvent.setup()
    open('/login')
    for (let i = 0; i < 5; i++) {
      await signIn(u, 'parent@demo.com', 'Sai@12345')
      await screen.findByRole('alert')
    }
    expect(screen.getByRole('alert').textContent).toBe('Sai 5 lần liên tiếp. Đăng nhập bị khóa trong 30 giây.')
    await signIn(u, 'parent@demo.com', 'Password@123')
    expect(screen.getByRole('alert').textContent).toMatch(/Bạn đã nhập sai quá nhiều lần. Thử lại sau \d+ giây./)
  }, 20000)
})

describe('đăng ký và admin duyệt (UC-02)', () => {
  const fillRegister = async (u, { email = 'moi@demo.com', nationalId = '012345678901' } = {}) => {
    await u.type(screen.getByLabelText('Họ và tên'), 'Nguyễn Văn Mới')
    await u.type(screen.getByLabelText('Email'), email)
    await u.type(screen.getByLabelText('Số điện thoại'), '0912 345 678')
    await pick(u, document.body, 'Tôi là', 'Phụ huynh')
    await u.type(screen.getByLabelText('Số CCCD'), nationalId)
    await u.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }))
  }

  it('UI-05 bỏ trống → báo lỗi cả 5 trường; gửi hợp lệ → màn hình "Đã gửi yêu cầu"', async () => {
    const u = userEvent.setup()
    open('/register')
    await u.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }))
    for (const msg of ['Nhập họ và tên', 'Email không hợp lệ', 'Số điện thoại không hợp lệ', 'Chọn vai trò của bạn', 'Số CCCD phải gồm 12 chữ số']) {
      expect(screen.getByText(msg)).toBeTruthy()
    }
    await fillRegister(u)
    expect(await screen.findByRole('heading', { name: 'Đã gửi yêu cầu' })).toBeTruthy()
  })

  it('UI-06 email đã có tài khoản → lỗi hiện dưới ô email', async () => {
    const u = userEvent.setup()
    open('/register')
    await fillRegister(u, { email: 'parent@demo.com' })
    expect(await screen.findByText('Email này đã được đăng ký')).toBeTruthy()
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true')
  })

  it('UI-07 admin thấy yêu cầu, CCCD bị che đến khi bấm "Hiện"; duyệt → gửi email link đặt mật khẩu', async () => {
    const u = userEvent.setup()
    open('/register')
    await fillRegister(u)
    await screen.findByRole('heading', { name: 'Đã gửi yêu cầu' })
    cleanup()

    open('/admin', 'admin@demo.com', 'admin')
    const row = await rowOf('moi@demo.com')
    expect(within(row).queryByText(/012345678901/)).toBeNull()
    expect(within(row).getByText(/••••••••8901/)).toBeTruthy()
    await u.click(within(row).getByRole('button', { name: 'Hiện' }))
    expect(within(row).getByText(/012345678901/)).toBeTruthy()

    await u.click(within(row).getByRole('button', { name: 'Duyệt' }))
    expect(await within(row).findByText('Đã duyệt')).toBeTruthy()
    expect(await screen.findByText('Đặt mật khẩu của bạn')).toBeTruthy()
  })

  it('UI-08 từ chối bắt buộc nhập lý do; lý do hiện trên dòng yêu cầu', async () => {
    const u = userEvent.setup()
    open('/register')
    await fillRegister(u)
    await screen.findByRole('heading', { name: 'Đã gửi yêu cầu' })
    cleanup()

    open('/admin', 'admin@demo.com', 'admin')
    const row = await rowOf('moi@demo.com')
    await u.click(within(row).getByRole('button', { name: 'Từ chối' }))
    const confirm = within(row).getByRole('button', { name: 'Xác nhận từ chối' })
    expect(confirm.disabled).toBe(true)
    await u.type(within(row).getByLabelText('Lý do từ chối'), '   ')
    expect(confirm.disabled).toBe(true)
    await u.type(within(row).getByLabelText('Lý do từ chối'), 'CCCD không khớp')
    await u.click(confirm)
    expect(await within(row).findByText('CCCD không khớp')).toBeTruthy()
    expect(within(row).getByText('Từ chối')).toBeTruthy()
  })
})

describe('quản lý tài khoản (UC-03)', () => {
  it('UI-09 admin không khóa / xóa được chính mình; sửa chính mình thì không đổi được vai trò', async () => {
    const u = userEvent.setup()
    open('/admin/users', 'admin@demo.com', 'admin')
    const self = await rowOf('admin@demo.com')
    expect(within(self).getByRole('button', { name: 'Khóa' }).disabled).toBe(true)
    expect(within(self).getByRole('button', { name: 'Xóa' }).disabled).toBe(true)

    await u.click(within(self).getByRole('button', { name: 'Sửa' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Bạn không thể đổi vai trò của chính mình.')).toBeTruthy()
    expect(within(dialog).getByRole('combobox', { name: 'Vai trò' }).disabled).toBe(true)
  })

  it('UI-10 khóa tài khoản người khác phải xác nhận; xong thì hiện "Mở khóa" và người đó không đăng nhập được', async () => {
    const u = userEvent.setup()
    open('/admin/users', 'admin@demo.com', 'admin')
    const row = await rowOf('chau.teacher@demo.com')
    await u.click(within(row).getByRole('button', { name: 'Khóa' }))
    const dialog = await screen.findByRole('dialog')
    await u.click(within(dialog).getByRole('button', { name: 'Khóa tài khoản' }))
    expect((await screen.findByRole('status')).textContent).toBe('Đã khóa tài khoản.')
    expect(await within(await rowOf('chau.teacher@demo.com')).findByRole('button', { name: 'Mở khóa' })).toBeTruthy()
    cleanup()

    open('/login')
    await u.type(screen.getByLabelText('Email'), 'chau.teacher@demo.com')
    await u.type(screen.getByLabelText('Mật khẩu'), 'Password@123')
    await u.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/bị quản trị viên khóa/)
  })

  it('UI-11 tạo tài khoản với email đã có → lỗi dưới ô email, không đóng hộp thoại', async () => {
    const u = userEvent.setup()
    open('/admin/users', 'admin@demo.com', 'admin')
    await u.click(await screen.findByRole('button', { name: 'Thêm tài khoản' }))
    const dialog = await screen.findByRole('dialog')
    await u.type(within(dialog).getByLabelText('Họ tên'), 'Trùng')
    await u.type(within(dialog).getByLabelText('Email'), 'parent@demo.com')
    await u.type(within(dialog).getByLabelText('Mật khẩu tạm thời'), 'Abc@12345')
    await u.click(within(dialog).getByRole('button', { name: 'Tạo tài khoản' }))
    expect(await within(dialog).findByText(/Email này đã được sử dụng/)).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})

describe('lớp học (UC-05)', () => {
  it('UI-12 tạo lớp trùng tên trong năm học → lỗi dưới ô tên; tên mới → tạo được', async () => {
    const u = userEvent.setup()
    open('/manager/classes', 'manager@demo.com', 'manager')
    await u.click(await screen.findByRole('button', { name: 'Thêm lớp' }))
    const dialog = await screen.findByRole('dialog')
    await u.type(within(dialog).getByLabelText('Tên lớp'), 'Lớp Mầm 1')
    await u.type(within(dialog).getByLabelText('Năm học'), '2026-2027')
    await u.click(within(dialog).getByRole('button', { name: 'Tạo lớp' }))
    expect(await within(dialog).findByText(/Đã có lớp cùng tên trong năm học này/)).toBeTruthy()

    await u.clear(within(dialog).getByLabelText('Tên lớp'))
    await u.type(within(dialog).getByLabelText('Tên lớp'), 'Lớp Lá 9')
    await u.click(within(dialog).getByRole('button', { name: 'Tạo lớp' }))
    expect((await screen.findByRole('status')).textContent).toBe('Đã tạo lớp Lớp Lá 9.')
    expect(await rowOf('Lớp Lá 9')).toBeTruthy()
  })

  it('UI-13 đóng lớp còn trẻ đang học → lỗi hiện trong hộp thoại, lớp vẫn hoạt động', async () => {
    const u = userEvent.setup()
    open('/manager/classes', 'manager@demo.com', 'manager')
    const row = await rowOf('Lớp Mầm 1')
    await u.click(within(row).getByRole('button', { name: 'Đóng lớp' }))
    const dialog = await screen.findByRole('dialog')
    await u.click(within(dialog).getByRole('button', { name: 'Đóng lớp' }))
    expect((await within(dialog).findByRole('alert')).textContent).toMatch(/Lớp còn 2 trẻ đang học/)
    expect(within(row).getByText('Hoạt động')).toBeTruthy()
  })

  it('UI-14 phân công thêm giáo viên → hiện tên giáo viên trên dòng lớp', async () => {
    const u = userEvent.setup()
    open('/manager/classes', 'manager@demo.com', 'manager')
    const row = await rowOf('Lớp Chồi 1')
    expect(within(row).queryByText('Nguyễn Thu Hà')).toBeNull()
    await u.click(within(row).getByRole('button', { name: 'Giáo viên' }))
    const dialog = await screen.findByRole('dialog')
    await u.click(await within(dialog).findByRole('checkbox', { name: /Nguyễn Thu Hà/ }))
    expect(within(dialog).getByText('1 thêm, 0 gỡ')).toBeTruthy()
    await u.click(within(dialog).getByRole('button', { name: 'Lưu phân công' }))
    expect((await screen.findByRole('status')).textContent).toBe('Đã cập nhật phân công cho Lớp Chồi 1.')
    expect(await within(await rowOf('Lớp Chồi 1')).findByText('Nguyễn Thu Hà')).toBeTruthy()
  })
})

describe('hồ sơ trẻ (UC-04)', () => {
  it('UI-15 ngày sinh ở tương lai → báo lỗi; tạo hợp lệ → mở hồ sơ, liên kết phụ huynh được', async () => {
    const u = userEvent.setup()
    open('/manager/children', 'manager@demo.com', 'manager')
    await u.click(await screen.findByRole('button', { name: 'Thêm trẻ' }))
    const dialog = await screen.findByRole('dialog')
    await u.type(within(dialog).getByLabelText('Họ tên'), 'Bé Mới')
    fireEvent.change(within(dialog).getByLabelText('Ngày sinh'), { target: { value: '2999-01-01' } })
    await pick(u, dialog, 'Giới tính', 'Nữ')
    await pick(u, dialog, 'Lớp', 'Lớp Mầm 1 (2026-2027)')
    await u.click(within(dialog).getByRole('button', { name: 'Tạo hồ sơ' }))
    expect(within(dialog).getByText('Ngày sinh không được ở tương lai')).toBeTruthy()

    fireEvent.change(within(dialog).getByLabelText('Ngày sinh'), { target: { value: '2022-02-02' } })
    await u.click(within(dialog).getByRole('button', { name: 'Tạo hồ sơ' }))
    expect(await screen.findByRole('heading', { name: 'Bé Mới' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/Đã tạo hồ sơ cho Bé Mới/)

    await u.type(screen.getByLabelText('Email hoặc số điện thoại phụ huynh'), 'parent2@demo.com')
    await u.click(screen.getByRole('button', { name: 'Tìm' }))
    await u.click(await screen.findByRole('button', { name: 'Liên kết' }))
    expect((await screen.findByRole('status')).textContent).toBe('Đã liên kết Đỗ Thị Mai (Mẹ) với Bé Mới.')
    expect(screen.getByRole('tab', { name: 'Phụ huynh (1)' })).toBeTruthy()
  })

  it('UI-16 phụ huynh đã liên kết thì không hiện nút "Liên kết" lần nữa', async () => {
    const u = userEvent.setup()
    open('/manager/children', 'manager@demo.com', 'manager')
    await u.click(within(await rowOf('Nguyễn Minh An')).getByRole('link', { name: 'Xem hồ sơ' }))
    await u.click(await screen.findByRole('tab', { name: /Phụ huynh/ }))
    await u.type(screen.getByLabelText('Email hoặc số điện thoại phụ huynh'), 'parent@demo.com')
    await u.click(screen.getByRole('button', { name: 'Tìm' }))
    expect(await screen.findByText('Đã liên kết')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Liên kết' })).toBeNull()
  })
})
