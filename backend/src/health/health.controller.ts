import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Kiểm tra dịch vụ còn sống' })
  @ApiOkResponse({
    schema: { example: { status: 'ok', timestamp: '2026-10-05T10:00:00.000Z' } },
  })
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Kiểm tra kết nối database' })
  async readiness() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', database: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unavailable' });
    }
  }
}
