import { DataSource } from 'typeorm';
import { createMigratedDatabase, dropDatabase, E2eApp, uniqueDbName } from './helpers/app';

// Giai đoạn 0 — hạ tầng: health check trên database thật, migration (NFR-MNT-02).

describe('GĐ0 · Health (e2e)', () => {
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await E2eApp.start('health');
  });
  afterAll(() => e2e.stop());

  it('E2E-HEALTH-01 GET /health → 200 ok', async () => {
    const res = await e2e.api().get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('E2E-HEALTH-02 GET /health/ready → 200, kết nối PostgreSQL thật', async () => {
    await e2e.api().get('/health/ready').expect(200, { status: 'ok', database: 'ok' });
  });

  it('E2E-HEALTH-03 route không tồn tại → 404 JSON, không lộ stack trace', async () => {
    const res = await e2e.api().get('/khong-ton-tai').expect(404);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.(ts|js):\d+/);
  });
});

describe('GĐ0 · Migrations (e2e)', () => {
  const dbName = uniqueDbName('migrations');
  let ds: DataSource;

  beforeAll(async () => {
    ds = await createMigratedDatabase(dbName);
  });
  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    await dropDatabase(dbName);
  });

  it('E2E-MIG-01 chạy toàn bộ migration trên database trắng, không còn migration chờ', async () => {
    expect(await ds.showMigrations()).toBe(false);
  });

  // Lỗi đã biết (README vấn đề #14): migration giai đoạn 2 tạo khóa ngoại, CHECK và index
  // mà entity không khai báo, nên `npm run migration:generate` lần tới sẽ sinh migration xóa chúng.
  // Khi entity đã khai báo đủ, test này sẽ báo fail → đổi it.failing thành it.
  it.failing('E2E-MIG-02 entity và migration khớp nhau (không có thay đổi schema chưa tạo migration)', async () => {
    const pending = await ds.driver.createSchemaBuilder().log();
    expect(pending.upQueries.map((q) => q.query)).toEqual([]);
  });

  it('E2E-MIG-03 revert hết migration rồi chạy lại được (mọi down() viết đúng)', async () => {
    for (let i = 0; i < ds.migrations.length; i++) {
      await ds.undoLastMigration({ transaction: 'each' });
    }
    const tables: { table_name: string }[] = await ds.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name <> 'migrations'`,
    );
    expect(tables).toEqual([]);

    await ds.runMigrations({ transaction: 'each' });
    expect(await ds.showMigrations()).toBe(false);
  });
});
