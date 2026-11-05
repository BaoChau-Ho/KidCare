import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { User } from "../users/user.entity";
import { ChildParent } from "./child-parent.entity";
import { Child } from "./child.entity";
import { ChildrenController } from "./children.controller";
import { ChildrenService } from "./children.service";

@Module({
	imports: [AuthModule, AuditLogsModule, TypeOrmModule.forFeature([Child, ChildParent, User])],
	controllers: [ChildrenController],
	providers: [ChildrenService],
})
export class ChildrenModule {}
