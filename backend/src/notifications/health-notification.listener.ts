import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { DataSource } from "typeorm";
import { ChildParent } from "../children/child-parent.entity";
import { DomainEventPublisher } from "../common/domain-events/domain-event.publisher";
import { NotificationsService } from "./notifications.service";

@Injectable()
export class HealthNotificationListener implements OnModuleInit, OnModuleDestroy {
	private unsubscribe?: () => void;

	constructor(
		private readonly events: DomainEventPublisher,
		private readonly dataSource: DataSource,
		private readonly notifications: NotificationsService,
	) {}

	onModuleInit() {
		this.unsubscribe = this.events.subscribe("health-record.changed", async ({ childId }) => {
			const links = await this.dataSource.getRepository(ChildParent).find({
				where: { childId },
				select: { parentUserId: true },
			});
			const recipientIds = [...new Set(links.map((link) => link.parentUserId))];
			await this.notifications.createHealthUpdate(recipientIds, childId);
		});
	}

	onModuleDestroy() {
		this.unsubscribe?.();
	}
}
