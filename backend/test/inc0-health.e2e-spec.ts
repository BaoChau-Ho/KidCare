import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { createFakeDataSource } from './helpers/fake-data-source';

// Increment 0 — hạ tầng. Mã test case: docs/03-testing/Test_Cases.md.
// Dùng DataSource giả nên chạy được cả khi máy không có PostgreSQL.

describe('Inc 0 — Health check và hạ tầng (e2e)', () => {
  describe('khi database hoạt động', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createTestApp(createFakeDataSource());
    });

    afterAll(async () => {
      await app.close();
    });

    it('TC-SYS-01 GET /health trả 200, status ok và timestamp dạng ISO', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);

      expect(res.body.status).toBe('ok');
      expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    });

    it('TC-SYS-02 GET /health/ready trả 200 khi database trả lời', async () => {
      const res = await request(app.getHttpServer()).get('/health/ready').expect(200);

      expect(res.body).toEqual({ status: 'ok', database: 'ok' });
    });

    it('TC-SYS-04 tài liệu Swagger có các endpoint health', () => {
      const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());

      expect(Object.keys(document.paths)).toEqual(
        expect.arrayContaining(['/health', '/health/ready']),
      );
    });

    it('TC-SEC-01 đường dẫn không tồn tại trả 404, không lộ stack trace', async () => {
      const res = await request(app.getHttpServer()).get('/khong-ton-tai').expect(404);

      expect(res.body.statusCode).toBe(404);
      expect(res.body).not.toHaveProperty('stack');
      expect(res.text).not.toMatch(/node_modules|\.ts:\d+/);
    });
  });

  describe('khi database lỗi', () => {
    const internalError = 'password authentication failed for user "kidcare"';
    let app: INestApplication;

    beforeAll(async () => {
      app = await createTestApp(createFakeDataSource({ queryError: new Error(internalError) }));
    });

    afterAll(async () => {
      await app.close();
    });

    it('TC-SYS-03 GET /health/ready trả 503 và không lộ chi tiết lỗi database', async () => {
      const res = await request(app.getHttpServer()).get('/health/ready').expect(503);

      expect(res.body.database).toBe('unavailable');
      expect(res.text).not.toContain(internalError);
    });
  });
});
