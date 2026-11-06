import { randomUUID } from 'node:crypto';
import { bearer, E2eApp, PASSWORD, TestUser } from './helpers/app';

// Giai đoạn 1 — UC-02 đăng ký, admin duyệt / từ chối. Gọi API thật trên PostgreSQL thật.

describe('GĐ1 · Registration API (e2e)', () => {
  let e2e: E2eApp;
  let admin: TestUser;
  let manager: TestUser;
  let seq = 0;

  beforeAll(async () => {
    e2e = await E2eApp.start('registration');
    admin = await e2e.createUser('ADMIN');
    manager = await e2e.createUser('MANAGER');
  });
  afterAll(() => e2e.stop());

  const form = (overrides: Record<string, unknown> = {}) => {
    seq += 1;
    return {
      fullName: 'Nguyễn Văn A',
      email: `reg${seq}@kidcare.test`,
      phone: '0912 345 678',
      role: 'PARENT',
      nationalId: String(100000000000 + seq),
      password: PASSWORD,
      ...overrides,
    };
  };
  const register = (body: object) => e2e.api().post('/auth/register').send(body);
  const login = (email: string) => e2e.api().post('/auth/login').send({ email, password: PASSWORD });
  const approve = (id: string, as = admin) => e2e.api().patch(`/admin/registration-requests/${id}/approve`).set(bearer(as));
  const reject = (id: string, reason: string, as = admin) =>
    e2e.api().patch(`/admin/registration-requests/${id}/reject`).set(bearer(as)).send({ reason });

  it('E2E-REG-01 luồng chính: đăng ký → chờ duyệt (403) → admin thấy yêu cầu → duyệt → đăng nhập được', async () => {
    const body = form({ email: '  New.Parent@KidCare.Test ' });
    const created = await register(body).expect(201);
    expect(created.body).toEqual({ id: expect.any(String), status: 'PENDING' });

    expect((await login('new.parent@kidcare.test').expect(403)).body.code).toBe('ACCOUNT_PENDING');

    const list = await e2e.api().get('/admin/registration-requests').set(bearer(admin)).expect(200);
    const request = list.body.find((r: { id: string }) => r.id === created.body.id);
    expect(request).toMatchObject({ email: 'new.parent@kidcare.test', phone: '0912345678', status: 'PENDING', role: 'PARENT' });
    expect(JSON.stringify(list.body)).not.toMatch(/argon2|password/i);

    await approve(created.body.id).expect(200);
    const res = await login('new.parent@kidcare.test').expect(200);
    expect(res.body.user).toMatchObject({ role: 'PARENT', status: 'ACTIVE', fullName: 'Nguyễn Văn A' });
  });

  it.each(['ADMIN', 'admin', 'SUPERUSER'])('E2E-REG-02 tự đăng ký vai trò %s → 400', async (role) => {
    await register(form({ role })).expect(400);
  });

  it('E2E-REG-03 email hoặc CCCD đã dùng (tài khoản hay yêu cầu đang chờ) → 409', async () => {
    const first = form();
    await register(first).expect(201);
    expect((await register(form({ email: first.email })).expect(409)).body.code).toBe('EMAIL_EXISTS');
    expect((await register(form({ nationalId: first.nationalId })).expect(409)).body.code).toBe('ID_EXISTS');
    expect((await register(form({ email: admin.email })).expect(409)).body.code).toBe('EMAIL_EXISTS');
  });

  it('E2E-REG-04 hai request đăng ký cùng email gửi đồng thời → đúng một yêu cầu được tạo', async () => {
    const body = form();
    const results = await Promise.all([register(body), register({ ...body, nationalId: '999999999999' })]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
    const [{ count }] = await e2e.ds.query(`SELECT count(*)::int AS count FROM users WHERE email = $1`, [body.email]);
    expect(count).toBe(1);
  });

  it('E2E-REG-05 từ chối: lý do bắt buộc ≥ 3 ký tự; xong thì tài khoản chờ bị xóa và đăng ký lại được', async () => {
    const body = form();
    const { body: created } = await register(body).expect(201);

    await reject(created.id, '  ab ').expect(400);
    const res = await reject(created.id, '  CCCD không khớp ').expect(200);
    expect(res.body).toEqual({ id: created.id, status: 'REJECTED', rejectionReason: 'CCCD không khớp' });

    expect((await login(body.email).expect(401)).body.code).toBe('INVALID_CREDENTIALS');
    await register(body).expect(201);
  });

  it('E2E-REG-06 duyệt / từ chối yêu cầu đã xử lý → 409; id không tồn tại → 404; id sai định dạng → 400', async () => {
    const { body: created } = await register(form()).expect(201);
    await approve(created.id).expect(200);

    expect((await approve(created.id).expect(409)).body.code).toBe('REQUEST_ALREADY_REVIEWED');
    expect((await reject(created.id, 'Đổi ý').expect(409)).body.code).toBe('REQUEST_ALREADY_REVIEWED');
    expect((await approve(randomUUID()).expect(404)).body.code).toBe('REQUEST_NOT_FOUND');
    await approve('123').expect(400);
  });

  it('E2E-REG-07 chỉ admin dùng được API duyệt: không token → 401, quản lý → 403', async () => {
    const { body: created } = await register(form()).expect(201);
    await e2e.api().get('/admin/registration-requests').expect(401);
    await e2e.api().get('/admin/registration-requests').set(bearer(manager)).expect(403);
    await approve(created.id, manager).expect(403);
    await reject(created.id, 'Không hợp lệ', manager).expect(403);

    const [{ status }] = await e2e.ds.query(`SELECT status FROM registration_requests WHERE id = $1`, [created.id]);
    expect(status).toBe('PENDING');
  });

  it.each([
    ['phone', '12345678'],
    ['nationalId', '12345678901'],
    ['password', 'Aa1!aaa'],
    ['fullName', 'A'],
    ['email', 'a'.repeat(250) + '@x.vn'],
  ])('E2E-REG-08 %s = %j không hợp lệ → 400, không tạo yêu cầu', async (field, value) => {
    const body = form({ [field]: value });
    await register(body).expect(400);
    const [{ count }] = await e2e.ds.query(`SELECT count(*)::int AS count FROM registration_requests WHERE national_id = $1`, [body.nationalId]);
    expect(count).toBe(0);
  });
});
