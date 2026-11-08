import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccessModule } from "../access/access.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { Child } from "../children/child.entity";
import { Classroom } from "../classes/class.entity";
import { DomainEventsModule } from "../common/domain-events/domain-events.module";
import { LeaveRequest } from "../leave-requests/leave-request.entity";
import { AttendanceController } from "./attendance.controller";
import { Attendance } from "./attendance.entity";
import { AttendanceService } from "./attendance.service";

@Module({
	imports: [
		AuthModule,
		AuditLogsModule,
		AccessModule,
		DomainEventsModule,
		TypeOrmModule.forFeature([Attendance, Child, Classroom, LeaveRequest]),
	],
	controllers: [AttendanceController],
	providers: [AttendanceService],
	exports: [AttendanceService],
})
export class AttendanceModule {}
