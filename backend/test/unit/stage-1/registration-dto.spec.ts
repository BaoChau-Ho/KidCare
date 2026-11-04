import { plainToInstance } from 'class-transformer';
import { invalidFields } from '../../helpers/mocks';
import { CreateRegistrationRequestDto } from '../../../src/registration-requests/dto/create-registration-request.dto';
import { RejectRegistrationRequestDto } from '../../../src/registration-requests/dto/reject-registration-request.dto';

// Giai đoạn 1 — validation của DTO đăng ký và từ chối đăng ký.
// Danh sách test và tiến độ: backend/test/README.md.
// Mỗi test bắt đầu từ bộ dữ liệu hợp lệ và chỉ đổi một trường.

const valid = {
  fullName: 'Nguyễn Văn A',
  email: 'parent@demo.com',
  phone: '0912345678',
  role: 'parent',
  nationalId: '012345678901',
  password: 'Password@123',
};

const check = (changes: object) =>
  invalidFields(CreateRegistrationRequestDto, { ...valid, ...changes });

// Email dài đúng `length` ký tự: phần trước @ 64 ký tự, tên miền gồm các nhãn tối đa 63 ký tự.
const emailOfLength = (length: number) => {
  const domainLength = length - 65;
  const lastLabel = 'd'.repeat(domainLength - 63 - 1 - 63 - 1 - 4);
  return `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${lastLabel}.com`;
};

describe('GĐ1 · CreateRegistrationRequestDto', () => {
  it('UT-DTO-REG-01 bộ dữ liệu hợp lệ không có lỗi', async () => {
    expect(await check({})).toEqual([]);
  });

  it.each([
    ['1 ký tự', 'A', ['fullName']],
    ['2 ký tự', 'AB', []],
    ['100 ký tự', 'A'.repeat(100), []],
    ['101 ký tự', 'A'.repeat(101), ['fullName']],
  ])('UT-DTO-REG-02 họ tên %s', async (_case, fullName, expected) => {
    expect(await check({ fullName })).toEqual(expected);
  });

  it('UT-DTO-REG-03 họ tên được trim trước khi kiểm tra độ dài', async () => {
    expect(await check({ fullName: '  A  ' })).toEqual(['fullName']);
  });

  it('UT-DTO-REG-04 email có khoảng trắng hai đầu được trim', async () => {
    const dto = plainToInstance(CreateRegistrationRequestDto, {
      ...valid,
      email: '  Parent@Demo.com  ',
    });

    expect(dto.email).toBe('Parent@Demo.com');
    expect(await check({ email: '  Parent@Demo.com  ' })).toEqual([]);
  });

  it.each([
    ['sai định dạng', 'parent.demo.com', ['email']],
    ['đúng biên 254 ký tự', emailOfLength(254), []],
    ['vượt biên 255 ký tự', emailOfLength(255), ['email']],
  ])('UT-DTO-REG-05 email %s', async (_case, email, expected) => {
    expect(await check({ email })).toEqual(expected);
  });

  it('UT-DTO-REG-06 số điện thoại có khoảng trắng được xóa khoảng trắng', async () => {
    const dto = plainToInstance(CreateRegistrationRequestDto, {
      ...valid,
      phone: '0912 345 678',
    });

    expect(dto.phone).toBe('0912345678');
    expect(await check({ phone: '0912 345 678' })).toEqual([]);
  });

  it.each([
    ['8 chữ số', '09123456', ['phone']],
    ['9 chữ số', '091234567', []],
    ['12 chữ số', '091234567890', []],
    ['13 chữ số', '0912345678901', ['phone']],
  ])('UT-DTO-REG-07 số điện thoại %s', async (_case, phone, expected) => {
    expect(await check({ phone })).toEqual(expected);
  });

  it.each([
    ['có dấu + đầu số', '+84912345678', []],
    ['có chữ cái', '09123abc78', ['phone']],
  ])('UT-DTO-REG-08 số điện thoại %s', async (_case, phone, expected) => {
    expect(await check({ phone })).toEqual(expected);
  });

  it.each(['parent', 'teacher', 'medical', 'manager'])(
    'UT-DTO-REG-09 vai trò "%s" được đăng ký',
    async (role) => {
      expect(await check({ role })).toEqual([]);
    },
  );

  it.each(['admin', 'ADMIN', ''])(
    'UT-DTO-REG-10 vai trò "%s" không được tự đăng ký',
    async (role) => {
      expect(await check({ role })).toEqual(['role']);
    },
  );

  it.each([
    ['11 chữ số', '01234567890', ['nationalId']],
    ['12 chữ số', '012345678901', []],
    ['13 chữ số', '0123456789012', ['nationalId']],
    ['12 ký tự có chữ cái', '01234567890a', ['nationalId']],
  ])('UT-DTO-REG-11 CCCD %s', async (_case, nationalId, expected) => {
    expect(await check({ nationalId })).toEqual(expected);
  });

  it.each([
    ['7 ký tự', 'Aa1@aaa', ['password']],
    ['8 ký tự', 'Aa1@aaaa', []],
    ['128 ký tự', 'Aa1@' + 'a'.repeat(124), []],
    ['129 ký tự', 'Aa1@' + 'a'.repeat(125), ['password']],
    ['thiếu chữ hoa', 'aa1@aaaa', ['password']],
    ['thiếu ký tự đặc biệt', 'Aa1aaaaa', ['password']],
  ])('UT-DTO-REG-12 mật khẩu %s', async (_case, password, expected) => {
    expect(await check({ password })).toEqual(expected);
  });
});

describe('GĐ1 · RejectRegistrationRequestDto', () => {
  it.each([
    ['2 ký tự', 'ab', ['reason']],
    ['3 ký tự', 'abc', []],
    ['500 ký tự', 'a'.repeat(500), []],
    ['501 ký tự', 'a'.repeat(501), ['reason']],
  ])('UT-DTO-REJ-01 lý do từ chối %s', async (_case, reason, expected) => {
    expect(
      await invalidFields(RejectRegistrationRequestDto, { reason }),
    ).toEqual(expected);
  });

  it('UT-DTO-REJ-02 lý do được trim trước khi kiểm tra độ dài', async () => {
    expect(
      await invalidFields(RejectRegistrationRequestDto, { reason: '  ab  ' }),
    ).toEqual(['reason']);
  });
});
