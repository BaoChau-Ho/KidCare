import 'dotenv/config';
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { RegistrationRequestsModule } from './registration-requests/registration-requests.module';
import { UsersModule } from './users/users.module';
import { ClassesModule } from './classes/classes.module';
import { ChildrenModule } from './children/children.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LeaveRequestsModule } from './leave-requests/leave-requests.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    ClassesModule,
    ChildrenModule,
    AttendanceModule,
    LeaveRequestsModule,
    HealthModule,
    RegistrationRequestsModule,
  ],
})
export class AppModule {}