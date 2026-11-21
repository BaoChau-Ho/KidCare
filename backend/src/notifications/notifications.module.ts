import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { ChildParent } from "../children/child-parent.entity";
import { DomainEventsModule } from "../common/domain-events/domain-events.module";
import { HealthNotificationListener } from "./health-notification.listener";
import { Notification } from "./notification.entity";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
	imports: [AuthModule, DomainEventsModule, TypeOrmModule.forFeature([Notification, ChildParent])],
	controllers: [NotificationsController],
	providers: [NotificationsService, HealthNotificationListener],
	exports: [NotificationsService],
})
export class NotificationsModule {}
