import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegistrationRequestsController } from './registration-requests.controller';
import { AdminRegistrationRequestsController } from './admin-registration-requests.controller';
import { RegistrationRequestsService } from './registration-requests.service';

@Module({
  imports: [AuthModule],
  controllers: [
    RegistrationRequestsController,
    AdminRegistrationRequestsController,
  ],
  providers: [
    RegistrationRequestsService,
    JwtAuthGuard,
    AdminGuard,
  ],
})
export class RegistrationRequestsModule {}