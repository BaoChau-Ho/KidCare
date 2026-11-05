import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { AuditLog } from "./audit-log.entity";
import { AuditLogsController } from "./audit-logs.controller";
import { AuditLogsService } from "./audit-logs.service";
import { User } from "../users/user.entity";
import { Classroom } from "../classes/class.entity";
import { Child } from "../children/child.entity";

@Module({
	imports: [AuthModule, TypeOrmModule.forFeature([AuditLog, User, Classroom, Child])],
	controllers: [AuditLogsController],
	providers: [AuditLogsService],
	exports: [AuditLogsService],
})
export class AuditLogsModule {}
