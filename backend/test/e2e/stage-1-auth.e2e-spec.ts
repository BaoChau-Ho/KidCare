import { JwtService } from '@nestjs/jwt';
import { User } from '../../src/users/user.entity';
import { bearer, E2eApp, PASSWORD, TestUser } from './helpers/app';

// Giai đoạn 1 — UC-01 đăng nhập, access token, /auth/me. Gọi API thật trên PostgreSQL thật.

describe('GĐ1 · Auth API (e2e)', () => {
  let e2e: E2eApp;
  let parent: TestUser;

  beforeAll(async () => {
    e2e = await E2eApp.start('auth');
    parent = await e2e.createUser('PARENT', { email: 'parent@kidcare.test' });
  });
  afterAll(() => e2e.stop());

  const login = (email: string, password: string) => e2e.api().post('/auth/login').send({ email, password });

  describe('POST /auth/login', () => {
    it('E2E-AUTH-01 đúng email + mật khẩu → 200, có token dùng được, response không có hash', async () => {
      const res = await login('parent@kidcare.test', PASSWORD).expect(200);

      expect(res.body.user).toEqual({
        id: parent.id,
        email: 'parent@kidcare.test',
        fullName: parent.fullName,
        role: 'PARENT',
        status: 'ACTIVE',
      });
      expect(JSON.stringify(res.body)).not.toMatch(/argon2|passwordHash/);

      const me = await e2e.api().get('/auth/me').set(bearer(res.body)).expect(200);
      expect(me.body).toMatchObject({ id: parent.id, role: 'PARENT' });
    });

    it('E2E-AUTH-02 email viết hoa vẫn đăng nhập được', async () => {
      await login('PARENT@KidCare.Test', PASSWORD).expect(200);
    });

    it('E2E-AUTH-03 sai mật khẩu và email không tồn tại trả response giống hệt nhau (không lộ tài khoản)', async () => {
      const wrongPassword = await login('parent@kidcare.test', 'Wrong@123').expect(401);
      const unknownEmail = await login('nobody@kidcare.test', PASSWORD).expect(401);
      expect(wrongPassword.body).toEqual(unknownEmail.body);
      expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
    });

    it.each([
      ['INACTIVE', 'ACCOUNT_PENDING'],
      ['LOCKED', 'ACCOUNT_DISABLED'],
    ] as const)('E2E-AUTH-04 tài khoản %s đúng mật khẩu → 403 %s, không có token', async (status, code) => {
      const user = await e2e.createUser('TEACHER', { status });
      const res = await login(user.email, PASSWORD).expect(403);
      expect(res.body.code).toBe(code);
      expect(res.body.token).toBeUndefined();
    });

    it.each([
      [{ email: 'parent@kidcare.test' }, 'thiếu mật khẩu'],
      [{ email: 'khong-phai-email', password: PASSWORD }, 'email sai định dạng'],
      [{ email: 'parent@kidcare.test', password: PASSWORD, role: 'ADMIN' }, 'thừa trường lạ'],
      [{ email: ["parent@kidcare.test"], password: PASSWORD }, 'email là mảng'],
      [{ email: "' OR 1=1 --", password: PASSWORD }, 'chuỗi SQL injection'],
    ])('E2E-AUTH-05 body %j (%s) → 400, không phải 500', async (body, _reason) => {
      await e2e.api().post('/auth/login').send(body).expect(400);
    });

    it('E2E-AUTH-06 mật khẩu được lưu dạng argon2, không lưu nguyên văn (NFR-SEC-01)', async () => {
      const [row]: { password_hash: string }[] = await e2e.ds.query(`SELECT password_hash FROM users WHERE id = $1`, [parent.id]);
      expect(row.password_hash).toMatch(/^\$argon2id\$/);
      expect(row.password_hash).not.toContain(PASSWORD);
    });

    // Lỗi đã biết (README vấn đề #5): chưa giới hạn số lần đăng nhập sai (NFR-SEC-03: 5 lần / phút).
    // Khi đã có rate limit, test này sẽ báo fail → đổi it.failing thành it.
    it.failing('E2E-AUTH-07 sai mật khẩu 5 lần liên tiếp → lần thứ 6 bị chặn (429)', async () => {
      const victim = await e2e.createUser('PARENT');
      for (let i = 0; i < 5; i++) await login(victim.email, 'Wrong@123').expect(401);
      await login(victim.email, 'Wrong@123').expect(429);
    });

    // Lỗi đã biết (README vấn đề #15): token sống 1 giờ, NFR-SEC-04 yêu cầu khoảng 15 phút.
    it.failing('E2E-AUTH-08 access token hết hạn sau tối đa 15 phút (NFR-SEC-04)', async () => {
      const res = await login('parent@kidcare.test', PASSWORD).expect(200);
      const { iat, exp } = e2e.app.get(JwtService).decode<{ iat: number; exp: number }>(res.body.token);
      expect(exp - iat).toBeLessThanOrEqual(15 * 60);
    });
  });

  describe('GET /auth/me (JwtAuthGuard)', () => {
    const me = () => e2e.api().get('/auth/me');

    it('E2E-AUTH-10 không gửi token → 401 MISSING_TOKEN', async () => {
      expect((await me().expect(401)).body.code).toBe('MISSING_TOKEN');
    });

    it.each([
      ['token rác', 'Bearer abc.def.ghi'],
      ['ký bằng secret khác', `Bearer ${new JwtService({ secret: 'other-secret' }).sign({ sub: 'a0000000-0000-4000-8000-000000000001' })}`],
      ['đã hết hạn', 'EXPIRED'],
      ['sub không phải UUID', 'NOT_UUID'],
    ])('E2E-AUTH-11 token %s → 401 INVALID_TOKEN', async (_case, header) => {
      const secret = process.env.JWT_SECRET!;
      const value =
        header === 'EXPIRED'
          ? `Bearer ${new JwtService({ secret }).sign({ sub: parent.id, exp: Math.floor(Date.now() / 1000) - 60 })}`
          : header === 'NOT_UUID'
            ? `Bearer ${new JwtService({ secret }).sign({ sub: '1' })}`
            : header;
      expect((await me().set('Authorization', value).expect(401)).body.code).toBe('INVALID_TOKEN');
    });

    it('E2E-AUTH-12 sai scheme (Basic) → 401', async () => {
      await me().set('Authorization', `Basic ${parent.token}`).expect(401);
    });

    it('E2E-AUTH-13 tài khoản bị khóa sau khi đã có token → token cũ bị từ chối ngay (401)', async () => {
      const user = await e2e.createUser('TEACHER');
      await me().set(bearer(user)).expect(200);
      await e2e.ds.getRepository(User).update(user.id, { status: 'LOCKED' });
      expect((await me().set(bearer(user)).expect(401)).body.code).toBe('ACCOUNT_INACTIVE');
    });

    it('E2E-AUTH-14 token của tài khoản đã bị xóa → 401', async () => {
      const user = await e2e.createUser('TEACHER');
      await e2e.ds.getRepository(User).delete(user.id);
      await me().set(bearer(user)).expect(401);
    });
  });
});
