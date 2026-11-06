import { randomUUID } from 'node:crypto';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { UserRole } from '../../src/users/user.entity';
import { bearer, E2eApp, TestUser, today } from './helpers/app';

// Giai đoạn 2 — phân quyền theo vai trò (FR-AUTH-02, NFR-SEC-05) và IDOR (NFR-SEC-02)
// cho UC-03, UC-04, UC-05. Dữ liệu được tạo qua API như người dùng thật.
//
//   Lớp A: giáo viên A, trẻ A (phụ huynh A)
//   Lớp B: giáo viên B, trẻ B (phụ huynh B)

const ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'TEACHER', 'PARENT', 'MEDICAL_STAFF'];

// Các API được phép gọi khi chưa đăng nhập. Mọi API khác phải trả 401 khi thiếu token.
const PUBLIC_ROUTES = [
  'GET /health',
  'GET /health/ready',
  'POST /auth/login',
  'POST /auth/register',
  'GET /auth/set-password/check',
  'POST /auth/set-password',
];

describe('GĐ2 · Phân quyền và IDOR (e2e)', () => {
  let e2e: E2eApp;
  const as: Record<string, TestUser> = {};
  let classA: string;
  let classB: string;
  let childA: string;
  let childB: string;

  const call = (method: string, path: string, user?: TestUser, body?: object) => {
    const req = e2e.api()[method.toLowerCase() as 'get'](path);
    if (user) req.set(bearer(user));
    return body ? req.send(body) : req;
  };

  async function createClass(name: string, teacher: TestUser) {
    const { body } = await call('POST', '/classes', as.MANAGER, { name, academicYear: '2026-2027' }).expect(201);
    await call('POST', `/classes/${body.id}/teachers`, as.MANAGER, { teacherUserIds: [teacher.id] }).expect(200);
    return body.id as string;
  }

  async function createChild(name: string, classId: string, parent: TestUser) {
    const { body } = await call('POST', '/children', as.MANAGER, { name, dateOfBirth: '2022-01-15', gender: 'FEMALE', classId }).expect(201);
    await call('POST', `/children/${body.id}/parents`, as.MANAGER, { parentUserId: parent.id, relationship: 'MOTHER' }).expect(201);
    return body.id as string;
  }

  beforeAll(async () => {
    e2e = await E2eApp.start('access');
    for (const role of ROLES) as[role] = await e2e.createUser(role);
    as.TEACHER_B = await e2e.createUser('TEACHER');
    as.PARENT_B = await e2e.createUser('PARENT');

    classA = await createClass('Lá 1', as.TEACHER);
    classB = await createClass('Lá 2', as.TEACHER_B);
    childA = await createChild('Bé A', classA, as.PARENT);
    childB = await createChild('Bé B', classB, as.PARENT_B);
  });
  afterAll(() => e2e.stop());

  describe('mặc định từ chối (NFR-SEC-05)', () => {
    it('E2E-SEC-01 mọi API không nằm trong danh sách công khai → 401 khi không có token', async () => {
      const doc = SwaggerModule.createDocument(e2e.app, new DocumentBuilder().build());
      const routes = Object.entries(doc.paths).flatMap(([path, ops]) =>
        Object.keys(ops).map((method) => ({ method: method.toUpperCase(), path })),
      );
      const protectedRoutes = routes.filter(({ method, path }) => !PUBLIC_ROUTES.includes(`${method} ${path}`));
      expect(protectedRoutes.length).toBeGreaterThanOrEqual(18);

      const leaks: string[] = [];
      for (const { method, path } of protectedRoutes) {
        const url = path.replace(/\{[^}]+\}/g, () => randomUUID());
        const res = await call(method, url);
        if (res.status !== 401) leaks.push(`${method} ${path} → ${res.status}`);
      }
      expect(leaks).toEqual([]);
    });
  });

  describe('ma trận vai trò × API đọc (FR-AUTH-02)', () => {
    const matrix: [string, Partial<Record<UserRole, number>>][] = [
      ['/users', { ADMIN: 200 }],
      ['/users?role=TEACHER', { ADMIN: 200, MANAGER: 200 }],
      [`/audit-logs?from=${today()}&to=${today()}`, { ADMIN: 200 }],
      ['/admin/registration-requests', { ADMIN: 200 }],
      ['/classes', { MANAGER: 200, TEACHER: 200 }],
      ['/children', { MANAGER: 200, TEACHER: 200, PARENT: 200 }],
    ];
    const cases = matrix.flatMap(([path, allowed]) => ROLES.map((role) => [path, role, allowed[role] ?? 403] as const));

    it.each(cases)('E2E-SEC-02 GET %s với vai trò %s → %i', async (path, role, expected) => {
      await call('GET', path, as[role]).expect(expected);
    });
  });

  describe('chỉ đúng vai trò mới được ghi dữ liệu', () => {
    const writes: [string, string, () => string, () => object, UserRole][] = [
      ['POST', '/users', () => '/users', () => ({ fullName: 'X', email: `x${randomUUID()}@kidcare.test`, temporaryPassword: 'Temp@12345', role: 'ADMIN' }), 'ADMIN'],
      ['PATCH', '/users/:id/role', () => `/users/${as.PARENT.id}/role`, () => ({ role: 'ADMIN' }), 'ADMIN'],
      ['PATCH', '/users/:id/status', () => `/users/${as.TEACHER.id}/status`, () => ({ status: 'LOCKED' }), 'ADMIN'],
      ['POST', '/classes', () => '/classes', () => ({ name: `Lớp ${randomUUID()}`, academicYear: '2026-2027' }), 'MANAGER'],
      ['PATCH', '/classes/:id', () => `/classes/${classA}`, () => ({ status: 'CLOSED' }), 'MANAGER'],
      ['POST', '/classes/:id/teachers', () => `/classes/${classB}/teachers`, () => ({ teacherUserIds: [as.TEACHER.id] }), 'MANAGER'],
      ['DELETE', '/classes/:id/teachers/:teacherId', () => `/classes/${classA}/teachers/${as.TEACHER.id}`, () => ({}), 'MANAGER'],
      ['POST', '/children', () => '/children', () => ({ name: 'Bé X', dateOfBirth: '2022-01-15', gender: 'MALE', classId: classA }), 'MANAGER'],
      ['PATCH', '/children/:id', () => `/children/${childA}`, () => ({ status: 'WITHDRAWN' }), 'MANAGER'],
      ['POST', '/children/:id/parents', () => `/children/${childB}/parents`, () => ({ parentUserId: as.PARENT.id, relationship: 'MOTHER' }), 'MANAGER'],
    ];
    const cases = writes.flatMap(([method, label, url, body, allowed]) =>
      ROLES.filter((role) => role !== allowed).map((role) => [method, label, role, url, body] as const),
    );

    it.each(cases)('E2E-SEC-03 %s %s với vai trò %s → 403, dữ liệu không đổi', async (method, _label, role, url, body) => {
      const before = await snapshot();
      await call(method, url(), as[role], body()).expect(403);
      expect(await snapshot()).toEqual(before);
    });

    async function snapshot() {
      const [counts] = await e2e.ds.query(`
        SELECT (SELECT count(*) FROM users)::int AS users,
               (SELECT count(*) FROM classes)::int AS classes,
               (SELECT count(*) FROM class_teachers)::int AS assignments,
               (SELECT count(*) FROM children)::int AS children,
               (SELECT count(*) FROM child_parents)::int AS links,
               (SELECT count(*) FROM audit_logs)::int AS audit,
               (SELECT string_agg(role || status, ',' ORDER BY id) FROM users) AS user_state,
               (SELECT string_agg(status, ',' ORDER BY id) FROM classes) AS class_state,
               (SELECT string_agg(status, ',' ORDER BY id) FROM children) AS child_state`);
      return counts;
    }
  });

  describe('IDOR — chỉ thấy dữ liệu trong phạm vi của mình (NFR-SEC-02)', () => {
    it('E2E-IDOR-01 phụ huynh A xem được con mình; xem con của phụ huynh B → 403, không lộ dữ liệu', async () => {
      const own = await call('GET', `/children/${childA}`, as.PARENT).expect(200);
      expect(own.body).toMatchObject({ name: 'Bé A', className: 'Lá 1' });

      const other = await call('GET', `/children/${childB}`, as.PARENT).expect(403);
      expect(other.body.code).toBe('CHILD_ACCESS_DENIED');
      expect(JSON.stringify(other.body)).not.toContain('Bé B');
    });

    it('E2E-IDOR-02 danh sách trẻ của phụ huynh A chỉ có con mình, kể cả khi lọc theo lớp của trẻ khác', async () => {
      const all = await call('GET', '/children', as.PARENT).expect(200);
      expect(all.body.items.map((c: { id: string }) => c.id)).toEqual([childA]);
      expect(all.body.pageInfo.totalItems).toBe(1);

      const filtered = await call('GET', `/children?classId=${classB}`, as.PARENT).expect(200);
      expect(filtered.body.items).toEqual([]);
    });

    it('E2E-IDOR-03 giáo viên A chỉ thấy lớp A và trẻ lớp A; mở lớp B / trẻ B → 403', async () => {
      const classes = await call('GET', '/classes', as.TEACHER).expect(200);
      expect(classes.body.items.map((c: { id: string }) => c.id)).toEqual([classA]);
      const children = await call('GET', '/children', as.TEACHER).expect(200);
      expect(children.body.items.map((c: { id: string }) => c.id)).toEqual([childA]);

      await call('GET', `/classes/${classA}`, as.TEACHER).expect(200);
      expect((await call('GET', `/classes/${classB}`, as.TEACHER).expect(403)).body.code).toBe('CLASS_ACCESS_DENIED');
      await call('GET', `/children/${childB}`, as.TEACHER).expect(403);
    });

    it('E2E-IDOR-04 giáo viên bị gỡ khỏi lớp → mất quyền xem trẻ của lớp ngay lập tức', async () => {
      const teacher = await e2e.createUser('TEACHER');
      await call('POST', `/classes/${classA}/teachers`, as.MANAGER, { teacherUserIds: [teacher.id] }).expect(200);
      await call('GET', `/children/${childA}`, teacher).expect(200);

      await call('DELETE', `/classes/${classA}/teachers/${teacher.id}`, as.MANAGER).expect(204);
      await call('GET', `/children/${childA}`, teacher).expect(403);
    });

    it('E2E-IDOR-05 phụ huynh bị đổi vai trò → mất quyền xem con ngay, không cần đăng nhập lại', async () => {
      const parent = await e2e.createUser('PARENT');
      await call('POST', `/children/${childB}/parents`, as.MANAGER, { parentUserId: parent.id, relationship: 'FATHER' }).expect(201);
      await call('GET', `/children/${childB}`, parent).expect(200);

      await call('PATCH', `/users/${parent.id}/role`, as.ADMIN, { role: 'TEACHER' }).expect(200);
      await call('GET', `/children/${childB}`, parent).expect(403);
    });

    it('E2E-IDOR-06 tài khoản bị admin khóa → mọi request bằng token cũ bị 401', async () => {
      const teacher = await e2e.createUser('TEACHER');
      await call('GET', '/classes', teacher).expect(200);
      await call('PATCH', `/users/${teacher.id}/status`, as.ADMIN, { status: 'LOCKED' }).expect(200);
      expect((await call('GET', '/classes', teacher).expect(401)).body.code).toBe('ACCOUNT_INACTIVE');
    });

    it('E2E-IDOR-07 id không phải UUID → 400; UUID không tồn tại → 404', async () => {
      await call('GET', '/children/1', as.PARENT).expect(400);
      await call('GET', '/classes/1%20OR%201=1', as.MANAGER).expect(400);
      await call('GET', `/children/${randomUUID()}`, as.MANAGER).expect(404);
    });
  });

  describe('không lộ dữ liệu nhạy cảm', () => {
    it('E2E-SEC-04 danh sách tài khoản không chứa hash mật khẩu và CCCD', async () => {
      await e2e.createUser('PARENT', { nationalId: '079012345678' });
      const res = await call('GET', '/users?limit=100', as.ADMIN).expect(200);
      const text = JSON.stringify(res.body);
      expect(text).not.toMatch(/argon2|passwordHash|password_hash|nationalId|079012345678/);
    });

    it('E2E-SEC-05 hồ sơ trẻ trả cho phụ huynh không chứa email, SĐT hay hash của phụ huynh khác', async () => {
      const res = await call('GET', `/children/${childA}`, as.PARENT).expect(200);
      expect(JSON.stringify(res.body)).not.toMatch(/argon2|passwordHash|@kidcare\.test/);
    });
  });
});
