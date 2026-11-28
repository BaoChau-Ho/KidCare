import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccessModule } from "../access/access.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { Child } from "../children/child.entity";
import { Classroom } from "../classes/class.entity";
import { User } from "../users/user.entity";
import { ActivitiesController } from "./activities.controller";
import { ActivityImagesController } from "./activity-images.controller";
import { ActivitiesService } from "./activities.service";
import { ActivityImage } from "./activity-image.entity";
import { ActivityParticipant } from "./activity-participant.entity";
import { Activity } from "./activity.entity";

@Module({
	imports: [AuthModule, AccessModule, AuditLogsModule, TypeOrmModule.forFeature([Activity, ActivityParticipant, ActivityImage, Child, Classroom, User])],
	controllers: [ActivitiesController, ActivityImagesController],
	providers: [ActivitiesService],
})
export class ActivitiesModule {}
