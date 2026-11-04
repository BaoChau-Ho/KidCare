import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import {
  createDataSourceMock,
  createRepositoryMock,
  expectHttpError,
  getError,
  RepositoryMock,
} from '../../helpers/mocks';
import { RegistrationRequest } from '../../../src/registration-requests/registration-request.entity';
import { User } from '../../../src/users/user.entity';
import { AuthService } from '../../../src/auth/auth.service';

// Giai đoạn 1 — AuthService: đăng nhập, kiểm tra link đặt mật khẩu, đặt mật khẩu.
// Danh sách test và tiến độ: backend/test/README.md.

jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
const mockedArgon2 = jest.mocked(argon2);

const NOW = new Date('2026-11-04T10:00:00Z').getTime();
const PASSWORD = 'Password@123';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  email: 'parent@demo.com',
  passwordHash: 'stored-hash',
  fullName: 'Nguyễn Văn A',
  role: 'parent',
  status: 'active',
  phone: '0912345678',
  nationalId: '012345678901',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const makeRequest = (
  overrides: Partial<RegistrationRequest> = {},
): RegistrationRequest => ({
  id: 1,
  fullName: 'Nguyễn Văn A',
  email: 'parent@demo.com',
  phone: '0912345678',
  role: 'parent',
  nationalId: '012345678901',
  status: 'approved',
  createdAt: new Date('2026-11-01T00:00:00Z'),
  rejectionReason: null,
  passwordSetupTokenHash: 'token-hash',
  passwordSetupExpiresAt: new Date(NOW + 60 * 60 * 1000),
  ...overrides,
});

describe('GĐ1 · AuthService', () => {
  let usersRepository: RepositoryMock;
  let userRepositoryInTransaction: RepositoryMock;
  let requestRepository: RepositoryMock;
  let jwtService: { signAsync: jest.Mock };
  let dataSource: ReturnType<typeof createDataSourceMock>;
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);

    usersRepository = createRepositoryMock();
    userRepositoryInTransaction = createRepositoryMock();
    requestRepository = createRepositoryMock();
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-token') };
    dataSource = createDataSourceMock(
      new Map<unknown, RepositoryMock>([
        [User, userRepositoryInTransaction],
        [RegistrationRequest, requestRepository],
      ]),
    );

    service = new AuthService(
      usersRepository as unknown as Repository<User>,
      jwtService as unknown as JwtService,
      dataSource as unknown as DataSource,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('login', () => {
    const login = (email = 'parent@demo.com', password = PASSWORD) =>
      service.login({ email, password });

    it('UT-LOGIN-01 email không tồn tại → 401 INVALID_CREDENTIALS, không kiểm tra mật khẩu', async () => {
      const error = await getError(() => login());

      expectHttpError(error, UnauthorizedException, 'INVALID_CREDENTIALS');
      expect(mockedArgon2.verify).not.toHaveBeenCalled();
    });

    it('UT-LOGIN-02 sai mật khẩu → 401 INVALID_CREDENTIALS', async () => {
      usersRepository.findOne.mockResolvedValue(makeUser());
      mockedArgon2.verify.mockResolvedValue(false);

      expectHttpError(
        await getError(() => login()),
        UnauthorizedException,
        'INVALID_CREDENTIALS',
      );
    });

    it('UT-LOGIN-03 sai email và sai mật khẩu trả cùng một thông báo', async () => {
      const unknownEmail = (await getError(() =>
        login(),
      )) as UnauthorizedException;

      usersRepository.findOne.mockResolvedValue(makeUser());
      mockedArgon2.verify.mockResolvedValue(false);
      const wrongPassword = (await getError(() =>
        login(),
      )) as UnauthorizedException;

      expect(wrongPassword.getResponse()).toEqual(unknownEmail.getResponse());
    });

    it('UT-LOGIN-04 tài khoản chờ duyệt nhưng sai mật khẩu → vẫn là INVALID_CREDENTIALS', async () => {
      usersRepository.findOne.mockResolvedValue(
        makeUser({ status: 'pending' }),
      );
      mockedArgon2.verify.mockResolvedValue(false);

      expectHttpError(
        await getError(() => login()),
        UnauthorizedException,
        'INVALID_CREDENTIALS',
      );
    });

    it('UT-LOGIN-05 tài khoản chờ duyệt, đúng mật khẩu → 403 ACCOUNT_PENDING, không cấp token', async () => {
      usersRepository.findOne.mockResolvedValue(
        makeUser({ status: 'pending' }),
      );
      mockedArgon2.verify.mockResolvedValue(true);

      expectHttpError(
        await getError(() => login()),
        ForbiddenException,
        'ACCOUNT_PENDING',
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('UT-LOGIN-06 tài khoản bị vô hiệu hóa → 403 ACCOUNT_DISABLED, không cấp token', async () => {
      usersRepository.findOne.mockResolvedValue(
        makeUser({ status: 'disabled' }),
      );
      mockedArgon2.verify.mockResolvedValue(true);

      expectHttpError(
        await getError(() => login()),
        ForbiddenException,
        'ACCOUNT_DISABLED',
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('UT-LOGIN-07 đăng nhập thành công → có token chứa id người dùng', async () => {
      const user = makeUser();
      usersRepository.findOne.mockResolvedValue(user);
      mockedArgon2.verify.mockResolvedValue(true);

      const result = await login();

      expect(mockedArgon2.verify).toHaveBeenCalledWith('stored-hash', PASSWORD);
      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: user.id });
      expect(result).toMatchObject({ token: 'signed-token', expiresIn: 3600 });
    });

    it('UT-LOGIN-08 response không chứa mật khẩu, CCCD, số điện thoại', async () => {
      usersRepository.findOne.mockResolvedValue(makeUser());
      mockedArgon2.verify.mockResolvedValue(true);

      const result = await login();

      expect(Object.keys(result.user).sort()).toEqual([
        'email',
        'fullName',
        'id',
        'role',
        'status',
      ]);
    });

    it('UT-LOGIN-09 email được trim và chuyển chữ thường trước khi tìm', async () => {
      await getError(() => login('  Parent@Demo.COM '));

      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'parent@demo.com' },
      });
    });
  });

  describe('checkSetupToken', () => {
    it('UT-SETUP-01 token được hash SHA-256 trước khi tra cứu', async () => {
      await getError(() => service.checkSetupToken('abc'));

      const expectedHash = createHash('sha256').update('abc').digest('hex');
      expect(requestRepository.findOneBy).toHaveBeenCalledWith({
        passwordSetupTokenHash: expectedHash,
        status: 'approved',
      });
    });

    it('UT-SETUP-02 không tìm thấy yêu cầu → 401 INVALID_TOKEN', async () => {
      const error = await getError(() => service.checkSetupToken('abc'));

      expectHttpError(error, UnauthorizedException, 'INVALID_TOKEN');
    });

    it('UT-SETUP-03 yêu cầu không có hạn sử dụng → 401 INVALID_TOKEN', async () => {
      requestRepository.findOneBy.mockResolvedValue(
        makeRequest({ passwordSetupExpiresAt: null }),
      );

      const error = await getError(() => service.checkSetupToken('abc'));

      expectHttpError(error, UnauthorizedException, 'INVALID_TOKEN');
    });

    it.each([
      ['UT-SETUP-04', 'hết hạn đúng lúc này', 0],
      ['UT-SETUP-06', 'đã hết hạn 1 ms', -1],
    ])('%s link %s → 401 EXPIRED', async (_id, _case, offsetMs) => {
      requestRepository.findOneBy.mockResolvedValue(
        makeRequest({ passwordSetupExpiresAt: new Date(NOW + offsetMs) }),
      );

      const error = await getError(() => service.checkSetupToken('abc'));

      expectHttpError(error, UnauthorizedException, 'EXPIRED');
    });

    it('UT-SETUP-05 link còn hạn 1 ms → hợp lệ', async () => {
      requestRepository.findOneBy.mockResolvedValue(
        makeRequest({ passwordSetupExpiresAt: new Date(NOW + 1) }),
      );

      await expect(service.checkSetupToken('abc')).resolves.toEqual({
        status: 'valid',
        email: 'parent@demo.com',
      });
    });
  });

  describe('setPassword', () => {
    const dto = { token: 'abc', password: PASSWORD };

    beforeEach(() => {
      mockedArgon2.hash.mockResolvedValue('new-hash');
    });

    it('UT-SETPWD-01 token không hợp lệ → dừng trước khi hash mật khẩu và mở transaction', async () => {
      const error = await getError(() => service.setPassword(dto));

      expectHttpError(error, UnauthorizedException, 'INVALID_TOKEN');
      expect(mockedArgon2.hash).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    describe('khi link hợp lệ', () => {
      let request: RegistrationRequest;

      beforeEach(() => {
        request = makeRequest();
        requestRepository.findOneBy.mockResolvedValue(request);
        requestRepository.findOne.mockResolvedValue(request);
      });

      it('UT-SETPWD-02 email đã có tài khoản → 409 EMAIL_EXISTS', async () => {
        userRepositoryInTransaction.findOneBy.mockImplementation(
          async (where: object) => ('email' in where ? makeUser() : null),
        );

        const error = await getError(() => service.setPassword(dto));

        expectHttpError(error, ConflictException, 'EMAIL_EXISTS');
        expect(userRepositoryInTransaction.save).not.toHaveBeenCalled();
      });

      it('UT-SETPWD-03 CCCD đã có tài khoản → 409 ID_EXISTS', async () => {
        userRepositoryInTransaction.findOneBy.mockImplementation(
          async (where: object) => ('nationalId' in where ? makeUser() : null),
        );

        const error = await getError(() => service.setPassword(dto));

        expectHttpError(error, ConflictException, 'ID_EXISTS');
        expect(userRepositoryInTransaction.save).not.toHaveBeenCalled();
      });

      it('UT-SETPWD-04 thành công → tạo tài khoản active với mật khẩu đã hash, đóng link', async () => {
        await service.setPassword(dto);

        expect(mockedArgon2.hash).toHaveBeenCalledWith(PASSWORD);
        expect(userRepositoryInTransaction.create).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'parent@demo.com',
            passwordHash: 'new-hash',
            role: 'parent',
            status: 'active',
          }),
        );
        expect(
          JSON.stringify(userRepositoryInTransaction.create.mock.calls),
        ).not.toContain(PASSWORD);
        expect(request).toMatchObject({
          status: 'completed',
          passwordSetupTokenHash: null,
          passwordSetupExpiresAt: null,
        });
        expect(requestRepository.save).toHaveBeenCalledWith(request);
      });

      it('UT-SETPWD-05 khóa dòng yêu cầu khi đọc lại trong transaction', async () => {
        await service.setPassword(dto);

        expect(requestRepository.findOne).toHaveBeenCalledWith(
          expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
        );
      });
    });
  });
});
