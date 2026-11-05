import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { User } from "./user.entity";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";

@Module({
	imports: [
		AuthModule,
		AuditLogsModule,
		TypeOrmModule.forFeature([User]),
	],
	controllers: [UsersController],
	providers: [UsersService],
})
export class UsersModule {}
