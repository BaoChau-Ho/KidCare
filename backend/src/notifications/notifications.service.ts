import { Injectable, NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";
import type { User } from "../users/user.entity";
import { ListNotificationsQueryDto } from "./dto/list-notifications-query.dto";
import { Notification } from "./notification.entity";

type NotificationActor = Pick<User, "id" | "role">;

@Injectable()
export class NotificationsService {
	constructor(private readonly dataSource: DataSource) {}

	async list(actor: NotificationActor, query: ListNotificationsQueryDto) {
		const qb = this.dataSource.getRepository(Notification)
			.createQueryBuilder("notification")
			.where("notification.recipientUserId = :recipientUserId", { recipientUserId: actor.id });
		if (query.unread) qb.andWhere("notification.readAt IS NULL");
		qb.orderBy("notification.createdAt", "DESC")
			.addOrderBy("notification.id", "DESC")
			.skip((query.page - 1) * query.limit)
			.take(query.limit);
		const [items, totalItems] = await qb.getManyAndCount();
		return {
			items: items.map((item) => this.toResponse(item)),
			pageInfo: {
				page: query.page,
				limit: query.limit,
				totalItems,
				totalPages: Math.ceil(totalItems / query.limit),
			},
		};
	}

	async unreadCount(actor: NotificationActor) {
		const unreadCount = await this.dataSource.getRepository(Notification)
			.createQueryBuilder("notification")
			.where("notification.recipientUserId = :recipientUserId", { recipientUserId: actor.id })
			.andWhere("notification.readAt IS NULL")
			.getCount();
		return { unreadCount };
	}

	async markRead(id: string, actor: NotificationActor) {
		const repository = this.dataSource.getRepository(Notification);
		const item = await repository.findOneBy({ id, recipientUserId: actor.id });
		if (!item) throw this.notFound();
		if (!item.readAt) {
			item.readAt = new Date();
			await repository.save(item);
		}
		return this.toResponse(item);
	}

	async markAllRead(actor: NotificationActor) {
		const result = await this.dataSource.getRepository(Notification)
			.createQueryBuilder()
			.update(Notification)
			.set({ readAt: () => "now()" })
			.where('"recipient_user_id" = :recipientUserId AND "read_at" IS NULL', { recipientUserId: actor.id })
			.execute();
		return { updated: result.affected ?? 0 };
	}

	async createHealthUpdate(recipientUserIds: string[], childId: string) {
		if (!recipientUserIds.length) return;
		const repository = this.dataSource.getRepository(Notification);
		await repository.insert(recipientUserIds.map((recipientUserId) => repository.create({
			recipientUserId,
			senderUserId: null,
			type: "HEALTH",
			title: "Hồ sơ sức khỏe đã được cập nhật",
			content: "Nhà trường vừa cập nhật hồ sơ sức khỏe của bé. Đăng nhập để xem thông tin dành cho phụ huynh.",
			relatedType: "child",
			relatedId: childId,
		})));
	}

	private toResponse(item: Notification) {
		return {
			id: item.id,
			title: item.title,
			content: item.content,
			type: item.type,
			channel: "IN_APP",
			relatedType: item.relatedType,
			relatedId: item.relatedId,
			isRead: item.readAt !== null,
			createdAt: item.createdAt.toISOString(),
		};
	}

	private notFound() {
		return new NotFoundException({
			code: "NOTIFICATION_NOT_FOUND",
			message: "Không tìm thấy thông báo.",
		});
	}
}
