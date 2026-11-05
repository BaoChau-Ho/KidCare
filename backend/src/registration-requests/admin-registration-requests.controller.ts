import {
  Body,
  Controller,
  Get,
  ParseUUIDPipe,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegistrationRequestsService } from './registration-requests.service';
import { RejectRegistrationRequestDto } from './dto/reject-registration-request.dto';

@Controller('admin/registration-requests')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminRegistrationRequestsController {
  constructor(
    private readonly registrationRequestsService: RegistrationRequestsService,
  ) {}

  @Get()
  list() {
    return this.registrationRequestsService.list();
  }

  @Patch(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrationRequestsService.approve(id);
  }

  @Patch(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRegistrationRequestDto,
  ) {
    return this.registrationRequestsService.reject(id, dto.reason);
  }
}
