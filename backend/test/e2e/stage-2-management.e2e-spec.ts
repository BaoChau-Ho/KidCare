import { bearer, E2eApp, PASSWORD, TestUser, today } from './helpers/app';

// Giai đoạn 2 — quy tắc nghiệp vụ UC-03, UC-04, UC-05 chạy trên PostgreSQL thật:
// luồng chính, ràng buộc database, ghi đồng thời, transaction, audit log.

describe('GĐ2 · Quản lý tài khoản, lớp, trẻ (e2e)', () => {
  let e2e: E2eApp;
  let admin: TestUser;
  let manager: TestUser;
  let teacher: TestUser;
  let seq = 0;

  beforeAll(async () => {
    e2e = await E2eApp.start('management');
    admin = await e2e.createUser('ADMIN');
    manager = await e2e.createUser('MANAGER');
    teacher = await e2e.createUser('TEACHER');
  });
  afterAll(() => e2e.stop());

  const api = () => e2e.api();
  const newClass = async (name = `Lớp ${++seq}`, academicYear = '2026-2027') =>
    (await api().post('/classes').set(bearer(manager)).send({ name, academicYear }).expect(201)).body;
  const newChild = async (classId: string, name = `Bé ${++seq}`) =>
    (await api().post('/children').set(bearer(manager)).send({ name, dateOfBirth: '2022-03-01', gender: 'MALE', classId }).expect(201)).body;
  const count = async (sql: string, params: unknown[] = []) => (await e2e.ds.query(sql, params))[0].count as number;

  it('E2E-FLOW-01 quản lý tạo lớp → tạo trẻ → gắn phụ huynh → phụ huynh đăng nhập thấy con', async () => {
    const parent = await e2e.createUser('PARENT', { email: 'me.cua.be@kidcare.test', fullName: 'Mẹ của bé' });
    const classroom = await newClass('Mầm 1');
    await api().post(`/classes/${classroom.id}/teachers`).set(bearer(manager)).send({ teacherUserIds: [teacher.id] }).expect(200);
    const child = await newChild(classroom.id, 'Bé Na');
    await api().post(`/children/${child.id}/parents`).set(bearer(manager)).send({ parentUserId: parent.id, relationship: 'MOTHER' }).expect(201);

    const login = await api().post('/auth/login').send({ email: 'me.cua.be@kidcare.test', password: PASSWORD }).expect(200);
    const list = await api().get('/children').set(bearer(login.body)).expect(200);
    expect(list.body.items).toEqual([
      expect.objectContaining({
        id: child.id,
        name: 'Bé Na',
        className: 'Mầm 1',
        status: 'ACTIVE',
        parents: [{ parentUserId: parent.id, fullName: 'Mẹ của bé', relationship: 'MOTHER' }],
      }),
    ]);

    const detail = await api().get(`/classes/${classroom.id}`).set(bearer(manager)).expect(200);
    expect(detail.body).toMatchObject({ childCount: 1, teacherUserIds: [teacher.id] });
  });

  describe('lớp học (UC-05)', () => {
    it('E2E-CLASS-01 trùng tên trong cùng năm học → 409; cùng tên khác năm học → 201 (ràng buộc thật của DB)', async () => {
      await newClass('Chồi 1', '2026-2027');
      const dup = await api().post('/classes').set(bearer(manager)).send({ name: 'Chồi 1', academicYear: '2026-2027' }).expect(409);
      expect(dup.body.code).toBe('CLASS_ALREADY_EXISTS');
      await newClass('Chồi 1', '2027-2028');
    });

    it('E2E-CLASS-02 không đóng được lớp còn trẻ đang học; cho trẻ nghỉ rồi đóng được; lớp đóng không nhận trẻ mới', async () => {
      const classroom = await newClass();
      const child = await newChild(classroom.id);

      const blocked = await api().patch(`/classes/${classroom.id}`).set(bearer(manager)).send({ status: 'CLOSED' }).expect(409);
      expect(blocked.body.code).toBe('CLASS_HAS_ACTIVE_CHILDREN');

      await api().patch(`/children/${child.id}`).set(bearer(manager)).send({ status: 'WITHDRAWN' }).expect(200);
      await api().patch(`/classes/${classroom.id}`).set(bearer(manager)).send({ status: 'CLOSED' }).expect(200);

      const rejected = await api().post('/children').set(bearer(manager))
        .send({ name: 'Bé mới', dateOfBirth: '2022-03-01', gender: 'MALE', classId: classroom.id }).expect(404);
      expect(rejected.body.code).toBe('CLASS_NOT_AVAILABLE');
      expect(await count(`SELECT count(*)::int AS count FROM children WHERE id = $1`, [child.id])).toBe(1); // không bị xóa
    });

    const assignTwiceConcurrently = async () => {
      const classroom = await newClass();
      const send = () => api().post(`/classes/${classroom.id}/teachers`).set(bearer(manager)).send({ teacherUserIds: [teacher.id] });
      const results = await Promise.all([send(), send()]);
      return { classroom, statuses: results.map((r) => r.status).sort((a, b) => a - b) };
    };

    it('E2E-CLASS-03 cùng phân công một giáo viên bằng 2 request đồng thời → chỉ 1 bản ghi, chỉ 1 request thành công', async () => {
      const { classroom, statuses } = await assignTwiceConcurrently();
      expect(statuses.filter((s) => s === 200)).toHaveLength(1);
      expect(await count(`SELECT count(*)::int AS count FROM class_teachers WHERE class_id = $1`, [classroom.id])).toBe(1);
    });

    // Lỗi đã biết (README vấn đề #16): request thua cuộc nhận 500 vì assignTeachers không bắt
    // unique violation của PK_class_teachers (linkParent thì có bắt). Khi đã sửa → đổi it.failing thành it.
    it.failing('E2E-CLASS-03b request phân công trùng gửi đồng thời nhận 409, không phải 500', async () => {
      // Làm chậm INSERT để cả 2 request chắc chắn qua bước kiểm tra trùng trước khi request đầu commit.
      await e2e.ds.query(`
        CREATE FUNCTION slow_class_teacher_insert() RETURNS trigger AS $$
        BEGIN PERFORM pg_sleep(0.3); RETURN NEW; END $$ LANGUAGE plpgsql;
        CREATE TRIGGER slow_class_teacher_insert BEFORE INSERT ON class_teachers
        FOR EACH ROW EXECUTE FUNCTION slow_class_teacher_insert();`);
      try {
        expect((await assignTwiceConcurrently()).statuses).toEqual([200, 409]);
      } finally {
        await e2e.ds.query(`DROP TRIGGER slow_class_teacher_insert ON class_teachers; DROP FUNCTION slow_class_teacher_insert();`);
      }
    });
  });

  describe('hồ sơ trẻ (UC-04)', () => {
    it('E2E-CHILD-01 gắn cùng một phụ huynh bằng 2 request đồng thời → chỉ 1 liên kết', async () => {
      const parent = await e2e.createUser('PARENT');
      const child = await newChild((await newClass()).id);
      const send = () => api().post(`/children/${child.id}/parents`).set(bearer(manager)).send({ parentUserId: parent.id, relationship: 'FATHER' });
      const results = await Promise.all([send(), send()]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
      expect(await count(`SELECT count(*)::int AS count FROM child_parents WHERE child_id = $1`, [child.id])).toBe(1);
    });

    it.each([
      ['2023-02-30', 400],
      ['2999-01-01', 400],
      ['01/02/2022', 400],
      ['2022-02-28', 201],
    ])('E2E-CHILD-02 ngày sinh %s → %i', async (dateOfBirth, expected) => {
      const classroom = await newClass();
      await api().post('/children').set(bearer(manager)).send({ name: 'Bé', dateOfBirth, gender: 'OTHER', classId: classroom.id }).expect(expected);
    });

    it('E2E-CHILD-03 lỗi giữa transaction (ghi audit log thất bại) → không còn hồ sơ trẻ dở dang (NFR-REL-02)', async () => {
      const classroom = await newClass();
      const before = await count(`SELECT count(*)::int AS count FROM children`);
      // Giả lập lỗi: database từ chối ghi audit log CREATE_CHILD.
      await e2e.ds.query(`
        CREATE FUNCTION fail_create_child_audit() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'injected failure'; END $$ LANGUAGE plpgsql;
        CREATE TRIGGER fail_create_child_audit BEFORE INSERT ON audit_logs
        FOR EACH ROW WHEN (NEW.action = 'CREATE_CHILD') EXECUTE FUNCTION fail_create_child_audit();`);
      try {
        const res = await api().post('/children').set(bearer(manager))
          .send({ name: 'Bé rollback', dateOfBirth: '2022-03-01', gender: 'MALE', classId: classroom.id });
        expect(res.status).toBe(500);
        expect(JSON.stringify(res.body)).not.toContain('injected failure'); // không lộ lỗi nội bộ
      } finally {
        await e2e.ds.query(`DROP TRIGGER fail_create_child_audit ON audit_logs; DROP FUNCTION fail_create_child_audit();`);
      }
      expect(await count(`SELECT count(*)::int AS count FROM children`)).toBe(before);
      expect(await count(`SELECT count(*)::int AS count FROM children WHERE name = 'Bé rollback'`)).toBe(0);
    });

    // Lỗi đã biết (README vấn đề #9): UpdateChildDto không bắt buộc độ dài tối thiểu cho tên.
    it.failing('E2E-CHILD-04 sửa tên trẻ thành toàn dấu cách → 400, tên cũ giữ nguyên', async () => {
      const child = await newChild((await newClass()).id, 'Bé Tên Cũ');
      await api().patch(`/children/${child.id}`).set(bearer(manager)).send({ name: '   ' }).expect(400);
    });
  });

  describe('tài khoản và audit log (UC-03, NFR-SEC-08)', () => {
    it('E2E-USER-01 admin tạo tài khoản → đăng nhập bằng mật khẩu tạm được; email trùng → 409', async () => {
      const body = { fullName: 'Giáo viên mới', email: ' New.Teacher@KidCare.test ', temporaryPassword: 'Temp@12345', role: 'TEACHER' };
      const created = await api().post('/users').set(bearer(admin)).send(body).expect(201);
      expect(created.body).toMatchObject({ email: 'new.teacher@kidcare.test', role: 'TEACHER', status: 'ACTIVE' });
      expect(JSON.stringify(created.body)).not.toMatch(/argon2|Temp@12345/);

      await api().post('/auth/login').send({ email: 'new.teacher@kidcare.test', password: 'Temp@12345' }).expect(200);
      expect((await api().post('/users').set(bearer(admin)).send(body).expect(409)).body.code).toBe('EMAIL_EXISTS');
    });

    it('E2E-USER-02 admin không tự khóa được chính mình (403), vẫn dùng được tài khoản', async () => {
      const res = await api().patch(`/users/${admin.id}/status`).set(bearer(admin)).send({ status: 'LOCKED' }).expect(403);
      expect(res.body.code).toBe('SELF_STATUS_CHANGE');
      await api().get('/users').set(bearer(admin)).expect(200);
    });

    it('E2E-USER-03 phân trang danh sách tài khoản: limit 101 → 400; page vượt số trang → danh sách rỗng', async () => {
      await api().get('/users?limit=101').set(bearer(admin)).expect(400);
      const res = await api().get('/users?page=999&limit=10').set(bearer(admin)).expect(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.pageInfo.page).toBe(999);
    });

    it('E2E-AUDIT-01 thao tác quản trị được ghi audit log: ai làm, hành động, đối tượng, IP, giá trị cũ / mới', async () => {
      const target = await e2e.createUser('PARENT');
      await api().patch(`/users/${target.id}/role`).set(bearer(admin)).send({ role: 'TEACHER' }).expect(200);

      const res = await api().get(`/audit-logs?from=${today()}&to=${today()}&resourceId=${target.id}`).set(bearer(admin)).expect(200);
      expect(res.body.items).toEqual([
        expect.objectContaining({
          actorUserId: admin.id,
          action: 'CHANGE_USER_ROLE',
          resourceType: 'user',
          resourceName: target.fullName,
          oldValue: { role: 'PARENT' },
          newValue: { role: 'TEACHER' },
          ipAddress: expect.any(String),
        }),
      ]);
    });

    it('E2E-AUDIT-02 audit log không chứa mật khẩu, hash, CCCD', async () => {
      await api().post('/users').set(bearer(admin))
        .send({ fullName: 'Audit', email: `audit${++seq}@kidcare.test`, temporaryPassword: 'Secret@999', role: 'PARENT' }).expect(201);
      const rows = await e2e.ds.query(`SELECT old_value, new_value FROM audit_logs`);
      expect(JSON.stringify(rows)).not.toMatch(/Secret@999|argon2|password|national/i);
    });

    it.each([
      [`from=${today()}`, 'thiếu to'],
      ['from=2026-11-10&to=2026-11-01', 'from sau to'],
      ['from=2026-13-01&to=2026-13-02', 'tháng 13'],
    ])('E2E-AUDIT-03 lọc audit log với %s (%s) → 400', async (query) => {
      await api().get(`/audit-logs?${query}`).set(bearer(admin)).expect(400);
    });

    // Lỗi đã biết (README vấn đề #17): DTO nhận "2026-11-01T00:00:00Z" nhưng service ghép thêm
    // "T00:00:00.000Z" thành ngày không hợp lệ → PostgreSQL lỗi → 500. Khi đã sửa → đổi it.failing thành it.
    it.failing('E2E-AUDIT-04 from / to có kèm giờ (chuẩn ISO 8601) → 400 hoặc 200, không được 500', async () => {
      const res = await api().get('/audit-logs?from=2026-11-01T00:00:00Z&to=2026-11-30T23:59:59Z').set(bearer(admin));
      expect([200, 400]).toContain(res.status);
    });
  });
});
