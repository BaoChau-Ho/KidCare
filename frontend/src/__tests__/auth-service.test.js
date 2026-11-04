import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { login, PASSWORD_RULES, REGISTER_ROLES, ROLES } from '../services/auth.js';

// Test cho services/auth.js (bản MOCK, chưa gọi backend). Mã test case: docs/03-testing/Test_Cases.md.
// Khi auth.js chuyển sang gọi API thật, giữ các test về mã lỗi để giao diện không phải sửa theo.

const DEMO_PASSWORD = 'Password@123';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  };
}

const failedRules = (password) =>
  PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.id);

describe('TC-AUTH-12 quy tắc mật khẩu', () => {
  it('mật khẩu đủ mạnh qua tất cả quy tắc', () => {
    expect(failedRules('Password@123')).toEqual([]);
  });

  it.each([
    ['Pa@1', 'len'],
    ['PASSWORD@123', 'lower'],
    ['password@123', 'upper'],
    ['Password@abc', 'digit'],
    ['Password123', 'special'],
  ])('"%s" không đạt quy tắc %s', (password, ruleId) => {
    expect(failedRules(password)).toEqual([ruleId]);
  });
});

describe('TC-AUTH-13 vai trò được tự đăng ký', () => {
  it('không cho tự đăng ký vai trò admin', () => {
    expect(REGISTER_ROLES).not.toContain('admin');
  });

  it('mọi vai trò đăng ký được đều là vai trò hợp lệ', () => {
    for (const role of REGISTER_ROLES) {
      expect(ROLES).toHaveProperty(role);
    }
  });
});

describe('TC-AUTH-14 đăng nhập trả đúng mã lỗi', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // login() có độ trễ giả lập; cho đồng hồ giả chạy hết rồi lấy kết quả.
  async function settle(promise) {
    const result = promise.then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    await vi.runAllTimersAsync();
    return result;
  }

  it('đúng email và mật khẩu → trả về vai trò và token', async () => {
    const { value } = await settle(login('parent@demo.com', DEMO_PASSWORD));
    expect(value.user.role).toBe('parent');
    expect(value.token).toBeTruthy();
  });

  it('email không phân biệt hoa thường', async () => {
    const { value } = await settle(login('Teacher@Demo.com', DEMO_PASSWORD));
    expect(value.user.role).toBe('teacher');
  });

  it.each([
    ['sai mật khẩu', 'parent@demo.com', 'Wrong@123', 'INVALID_CREDENTIALS'],
    ['email không tồn tại', 'nobody@demo.com', DEMO_PASSWORD, 'INVALID_CREDENTIALS'],
    ['tài khoản chờ duyệt', 'pending@demo.com', DEMO_PASSWORD, 'PENDING'],
    ['tài khoản bị khóa', 'disabled@demo.com', DEMO_PASSWORD, 'DISABLED'],
  ])('%s → %s', async (_case, email, password, code) => {
    const { error } = await settle(login(email, password));
    expect(error).toMatchObject({ code });
  });

  it('sai mật khẩu và email không tồn tại trả cùng một thông báo', async () => {
    const wrongPassword = await settle(login('parent@demo.com', 'Wrong@123'));
    const unknownEmail = await settle(login('nobody@demo.com', DEMO_PASSWORD));
    expect(wrongPassword.error.message).toBe(unknownEmail.error.message);
  });
});
