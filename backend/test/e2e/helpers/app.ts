import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { User, type UserRole } from '../../../src/users/user.entity';

// Mỗi file e2e chạy trên một database PostgreSQL tạm, tạo mới và chạy đủ migration,
// xong thì xóa. Không đụng vào database dev.
// Cần PostgreSQL đang chạy. Máy dev dùng docker compose (cổng 5433) nên phải đặt DB_PORT=5433;
// CI dùng service postgres ở cổng 5432 (mặc định).

export const PASSWORD = 'Password@123';

const connection = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'user',
  password: process.env.DB_PASSWORD ?? 'password',
} as const;
const adminDatabase = process.env.DB_DATABASE ?? 'mydb';
const srcDir = `${__dirname}/../../../src`;

async function withAdmin<T>(work: (admin: DataSource) => Promise<T>): Promise<T> {
  const admin = await new DataSource({ ...connection, database: adminDatabase }).initialize();
  try {
    return await work(admin);
  } finally {
    await admin.destroy();
  }
}

/** Tạo database trống và chạy toàn bộ migration. Trả về DataSource đang mở tới database đó. */
export async function createMigratedDatabase(name: string): Promise<DataSource> {
  await withAdmin((admin) => admin.query(`CREATE DATABASE "${name}"`));
  const ds = await new DataSource({
    ...connection,
    database: name,
    uuidExtension: 'pgcrypto',
    entities: [`${srcDir}/**/*.entity{.ts,.js}`],
    migrations: [`${srcDir}/database/migrations/*{.ts,.js}`],
  }).initialize();
  await ds.runMigrations({ transaction: 'each' });
  return ds;
}

export async function dropDatabase(name: string): Promise<void> {
  await withAdmin((admin) => admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`));
}

export const uniqueDbName = (label: string) => `kidcare_e2e_${label}_${process.pid}_${Date.now()}`;

// Hash mật khẩu một lần rồi dùng lại cho mọi tài khoản seed (argon2 chậm có chủ đích).
let passwordHash: Promise<string> | undefined;
const hashedPassword = () => (passwordHash ??= argon2.hash(PASSWORD));

export type TestUser = User & { token: string };

export const bearer = (user: { token: string }) => ({ Authorization: `Bearer ${user.token}` });

export const today = () => new Date().toISOString().slice(0, 10);

export class E2eApp {
  private seq = 0;

  private constructor(
    readonly app: INestApplication,
    readonly ds: DataSource,
    private readonly dbName: string,
  ) {}

  static async start(label: string): Promise<E2eApp> {
    const dbName = uniqueDbName(label);
    try {
      await (await createMigratedDatabase(dbName)).destroy();
      process.env.DB_DATABASE = dbName; // DatabaseModule đọc biến này khi khởi tạo DataSource
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
      const app = moduleRef.createNestApplication();
      // ValidationPipe được gắn trong bootstrap() của main.ts, không nằm trong AppModule,
      // nên phải gắn lại ở đây với đúng cấu hình đó.
      app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
      await app.init();
      return new E2eApp(app, app.get(DataSource), dbName);
    } catch (error) {
      process.env.DB_DATABASE = adminDatabase;
      await dropDatabase(dbName);
      throw error;
    }
  }

  api() {
    return request(this.app.getHttpServer());
  }

  tokenFor(user: Pick<User, 'id'>): string {
    return this.app.get(JwtService).sign({ sub: user.id });
  }

  /** Tạo tài khoản trực tiếp trong database (mật khẩu PASSWORD) kèm access token. */
  async createUser(role: UserRole, overrides: Partial<User> = {}): Promise<TestUser> {
    this.seq += 1;
    const repository = this.ds.getRepository(User);
    const user = await repository.save(
      repository.create({
        email: `${role.toLowerCase()}${this.seq}@kidcare.test`,
        passwordHash: await hashedPassword(),
        fullName: `${role} ${this.seq}`,
        role,
        status: 'ACTIVE',
        phone: null,
        nationalId: null,
        ...overrides,
      }),
    );
    return Object.assign(user, { token: this.tokenFor(user) });
  }

  async stop(): Promise<void> {
    await this.app.close();
    // DatabaseModule tự tạo DataSource bằng useFactory nên app.close() không đóng kết nối.
    if (this.ds.isInitialized) await this.ds.destroy();
    process.env.DB_DATABASE = adminDatabase;
    await dropDatabase(this.dbName);
  }
}
