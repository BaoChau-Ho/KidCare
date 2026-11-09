import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccessModule } from "../access/access.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { Child } from "../children/child.entity";
import { Classroom } from "../classes/class.entity";
import { DomainEventsModule } from "../common/domain-events/domain-events.module";
import { User } from "../users/user.entity";
import { LeaveRequestsController } from "./leave-requests.controller";
import { LeaveRequest } from "./leave-request.entity";
import { LeaveRequestsService } from "./leave-requests.service";

@Module({
	imports: [
		AuthModule,
		AuditLogsModule,
		AccessModule,
		DomainEventsModule,
		TypeOrmModule.forFeature([LeaveRequest, Child, Classroom, User]),
	],
	controllers: [LeaveRequestsController],
	providers: [LeaveRequestsService],
	exports: [LeaveRequestsService],
})
export class LeaveRequestsModule {}
