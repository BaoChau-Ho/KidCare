import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { User } from "../users/user.entity";
import { Child } from "../children/child.entity";
import { ClassTeacher } from "./class-teacher.entity";
import { Classroom } from "./class.entity";
import { ClassesController } from "./classes.controller";
import { ClassesService } from "./classes.service";

@Module({
	imports: [
		AuthModule,
		AuditLogsModule,
		TypeOrmModule.forFeature([Classroom, ClassTeacher, User, Child]),
	],
	controllers: [ClassesController],
	providers: [ClassesService],
})
export class ClassesModule {}
