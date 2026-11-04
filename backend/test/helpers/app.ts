import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';

/**
 * Tạo app NestJS cho e2e test.
 * - Không truyền `dataSource`: dùng PostgreSQL thật theo biến môi trường DB_* (giống CI trên main).
 * - Truyền `dataSource` (ví dụ từ createFakeDataSource): chạy được khi không có database.
 *
 * Khi main.ts thêm cấu hình toàn cục (ValidationPipe, global prefix, ...),
 * thêm cấu hình đó vào đây để test chạy giống app thật.
 */
export async function createTestApp(dataSource?: DataSource): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (dataSource) {
    builder = builder.overrideProvider(DataSource).useValue(dataSource);
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}
