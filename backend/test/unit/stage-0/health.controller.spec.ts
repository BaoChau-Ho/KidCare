import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getError } from '../../helpers/mocks';
import { HealthController } from '../../../src/health/health.controller';

// Giai đoạn 0 — health check.
// Danh sách test và tiến độ: backend/test/README.md.

describe('GĐ0 · HealthController', () => {
  const createController = (query: jest.Mock) =>
    new HealthController({ query } as unknown as DataSource);

  it('UT-HEALTH-01 check() trả status ok và timestamp dạng ISO', () => {
    const result = createController(jest.fn()).check();

    expect(result.status).toBe('ok');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('UT-HEALTH-02 readiness() trả ok khi database trả lời', async () => {
    const query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);

    await expect(createController(query).readiness()).resolves.toEqual({
      status: 'ok',
      database: 'ok',
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('UT-HEALTH-03 readiness() trả 503 và không lộ nội dung lỗi database', async () => {
    const internalError = 'password authentication failed for user "kidcare"';
    const query = jest.fn().mockRejectedValue(new Error(internalError));

    const error = await getError(() => createController(query).readiness());

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    const response = (error as ServiceUnavailableException).getResponse();
    expect(response).toEqual({ status: 'error', database: 'unavailable' });
    expect(JSON.stringify(response)).not.toContain(internalError);
  });
});
