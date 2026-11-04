import { invalidFields } from '../../helpers/mocks';
import { LoginDto } from '../../../src/auth/dto/login.dto';
import { SetPasswordDto } from '../../../src/auth/dto/set-password.dto';

// Giai đoạn 1 — validation của DTO đăng nhập và đặt mật khẩu.
// Danh sách test và tiến độ: backend/test/README.md.

const STRONG_PASSWORD = 'Password@123';

describe('GĐ1 · LoginDto', () => {
  const valid = { email: 'parent@demo.com', password: 'x' };

  it('UT-DTO-LOGIN-01 dữ liệu hợp lệ không có lỗi', async () => {
    expect(await invalidFields(LoginDto, valid)).toEqual([]);
  });

  it.each(['parent', 'parent@', ''])(
    'UT-DTO-LOGIN-02 email sai định dạng "%s" bị từ chối',
    async (email) => {
      expect(await invalidFields(LoginDto, { ...valid, email })).toEqual([
        'email',
      ]);
    },
  );

  it('UT-DTO-LOGIN-03 mật khẩu rỗng bị từ chối', async () => {
    expect(await invalidFields(LoginDto, { ...valid, password: '' })).toEqual([
      'password',
    ]);
  });

  it('UT-DTO-LOGIN-04 sai kiểu dữ liệu bị từ chối', async () => {
    expect(
      await invalidFields(LoginDto, { email: null, password: 123 }),
    ).toEqual(['email', 'password']);
  });
});

describe('GĐ1 · SetPasswordDto', () => {
  const withPassword = (password: string) => ({
    token: 'setup-token',
    password,
  });

  it.each([
    ['UT-DTO-PWD-01', 'dưới biên: 7 ký tự', 'Aa1@aaa', ['password']],
    ['UT-DTO-PWD-02', 'đúng biên dưới: 8 ký tự', 'Aa1@aaaa', []],
    [
      'UT-DTO-PWD-03',
      'đúng biên trên: 128 ký tự',
      'Aa1@' + 'a'.repeat(124),
      [],
    ],
    [
      'UT-DTO-PWD-04',
      'vượt biên trên: 129 ký tự',
      'Aa1@' + 'a'.repeat(125),
      ['password'],
    ],
  ])('%s độ dài mật khẩu %s', async (_id, _case, password, expected) => {
    expect(await invalidFields(SetPasswordDto, withPassword(password))).toEqual(
      expected,
    );
  });

  it.each([
    ['thiếu chữ thường', 'AA1@AAAA'],
    ['thiếu chữ hoa', 'aa1@aaaa'],
    ['thiếu chữ số', 'Aa@aaaaa'],
    ['thiếu ký tự đặc biệt', 'Aa1aaaaa'],
  ])('UT-DTO-PWD-05 mật khẩu %s bị từ chối', async (_case, password) => {
    expect(await invalidFields(SetPasswordDto, withPassword(password))).toEqual(
      ['password'],
    );
  });

  it('UT-DTO-PWD-06 token rỗng bị từ chối', async () => {
    expect(
      await invalidFields(SetPasswordDto, {
        token: '',
        password: STRONG_PASSWORD,
      }),
    ).toEqual(['token']);
  });
});
