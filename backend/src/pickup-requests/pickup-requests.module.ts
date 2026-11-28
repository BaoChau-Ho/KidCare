import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccessModule } from "../access/access.module";
import { AttendanceModule } from "../attendance/attendance.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { Child } from "../children/child.entity";
import { Classroom } from "../classes/class.entity";
import { User } from "../users/user.entity";
import { NotificationsModule } from "../notifications/notifications.module";
import { PickupRequestsController } from "./pickup-requests.controller";
import { PickupRequest } from "./pickup-request.entity";
import { PickupRequestsService } from "./pickup-requests.service";

@Module({
	imports: [AuthModule, AccessModule, AttendanceModule, AuditLogsModule, NotificationsModule, TypeOrmModule.forFeature([PickupRequest, Child, Classroom, User])],
	controllers: [PickupRequestsController],
	providers: [PickupRequestsService],
})
export class PickupRequestsModule {}
