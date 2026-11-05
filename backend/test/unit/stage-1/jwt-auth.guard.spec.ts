import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import {
  createHttpContext,
  createRepositoryMock,
  expectHttpError,
  getError,
  RepositoryMock,
} from '../../helpers/mocks';
import { User } from '../../../src/users/user.entity';
import { JwtAuthGuard } from '../../../src/auth/jwt-auth.guard';

// Giai đoạn 1 — JwtAuthGuard: kiểm tra access token trước khi vào route cần đăng nhập.
// Danh sách test và tiến độ: backend/test/README.md.

const USER_ID = 'b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: USER_ID,
  email: 'parent@demo.com',
  passwordHash: 'stored-hash',
  fullName: 'Nguyễn Văn A',
  role: 'PARENT',
  status: 'ACTIVE',
  phone: '0912345678',
  nationalId: '012345678901',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('GĐ1 · JwtAuthGuard', () => {
  let jwtService: { verifyAsync: jest.Mock };
  let usersRepository: RepositoryMock;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn().mockResolvedValue({ sub: USER_ID }) };
    usersRepository = createRepositoryMock();
    usersRepository.findOne.mockResolvedValue(makeUser());
    guard = new JwtAuthGuard(
      jwtService as unknown as JwtService,
      usersRepository as unknown as Repository<User>,
    );
  });

  const requestWith = (
    authorization?: string,
  ): { headers: object; user?: object } => ({
    headers: authorization === undefined ? {} : { authorization },
  });
  const run = (request: object) =>
    guard.canActivate(createHttpContext(request));

  it('UT-JWT-01 không có header Authorization → 401 MISSING_TOKEN', async () => {
    expectHttpError(
      await getError(() => run(requestWith())),
      UnauthorizedException,
      'MISSING_TOKEN',
    );
  });

  it('UT-JWT-02 sai scheme (Basic) → 401 MISSING_TOKEN', async () => {
    const error = await getError(() => run(requestWith('Basic abc')));

    expectHttpError(error, UnauthorizedException, 'MISSING_TOKEN');
  });

  it.each(['Bearer', 'Bearer '])(
    'UT-JWT-03 có scheme nhưng thiếu token ("%s") → 401 MISSING_TOKEN',
    async (authorization) => {
      const error = await getError(() => run(requestWith(authorization)));

      expectHttpError(error, UnauthorizedException, 'MISSING_TOKEN');
    },
  );

  it('UT-JWT-04 scheme viết thường "bearer" vẫn được chấp nhận', async () => {
    await expect(run(requestWith('bearer valid-token'))).resolves.toBe(true);
  });

  it('UT-JWT-05 token sai hoặc hết hạn → 401 INVALID_TOKEN', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    const error = await getError(() =>
      run(requestWith('Bearer expired-token')),
    );

    expectHttpError(error, UnauthorizedException, 'INVALID_TOKEN');
  });

  it.each([
    ['id kiểu số (token cũ)', { sub: 1 }],
    ['chuỗi không phải UUID', { sub: 'abc' }],
    ['không có sub', {}],
  ])(
    'UT-JWT-06 payload có %s → 401 INVALID_TOKEN, không truy vấn database',
    async (_case, payload) => {
      jwtService.verifyAsync.mockResolvedValue(payload);

      const error = await getError(() => run(requestWith('Bearer some-token')));

      expectHttpError(error, UnauthorizedException, 'INVALID_TOKEN');
      expect(usersRepository.findOne).not.toHaveBeenCalled();
    },
  );

  it('UT-JWT-07 người dùng không còn tồn tại → 401 ACCOUNT_INACTIVE', async () => {
    usersRepository.findOne.mockResolvedValue(null);

    const error = await getError(() => run(requestWith('Bearer valid-token')));

    expectHttpError(error, UnauthorizedException, 'ACCOUNT_INACTIVE');
  });

  it.each(['INACTIVE', 'LOCKED'] as const)(
    'UT-JWT-08 tài khoản ở trạng thái %s → 401 ACCOUNT_INACTIVE',
    async (status) => {
      usersRepository.findOne.mockResolvedValue(makeUser({ status }));

      const error = await getError(() =>
        run(requestWith('Bearer valid-token')),
      );

      expectHttpError(error, UnauthorizedException, 'ACCOUNT_INACTIVE');
    },
  );

  it('UT-JWT-09 token hợp lệ → cho qua, request.user không chứa mật khẩu', async () => {
    const request = requestWith('Bearer valid-token');

    await expect(run(request)).resolves.toBe(true);

    expect(usersRepository.findOne).toHaveBeenCalledWith({
      where: { id: USER_ID },
    });
    expect(Object.keys(request.user ?? {}).sort()).toEqual([
      'email',
      'fullName',
      'id',
      'role',
      'status',
    ]);
  });
});
