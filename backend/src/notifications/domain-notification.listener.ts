import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { DataSource } from "typeorm";
import { ChildParent } from "../children/child-parent.entity";
import { Child } from "../children/child.entity";
import { ClassTeacher } from "../classes/class-teacher.entity";
import { DomainEventPublisher } from "../common/domain-events/domain-event.publisher";
import { NotificationsService } from "./notifications.service";

@Injectable()
export class DomainNotificationListener implements OnModuleInit, OnModuleDestroy {
	private unsubscribers: Array<() => void> = [];

	constructor(
		private readonly events: DomainEventPublisher,
		private readonly dataSource: DataSource,
		private readonly notifications: NotificationsService,
	) {}

	onModuleInit() {
		this.unsubscribers.push(
			this.events.subscribe("leave-request.created", async (event) => {
				const teachers = await this.dataSource.getRepository(ClassTeacher).find({
					where: { classId: event.classId }, select: { teacherUserId: true },
				});
				const child = await this.dataSource.getRepository(Child).findOneBy({ id: event.childId });
				await this.notifications.createForUsers(teachers.map(({ teacherUserId }) => teacherUserId), {
					type: "LEAVE", title: `Đơn xin nghỉ của ${child?.name ?? "trẻ"}`,
					content: `Nghỉ từ ${event.fromDate} đến ${event.toDate}.`,
					relatedType: "leave", relatedId: event.leaveRequestId,
				});
			}),
			this.events.subscribe("leave-request.decided", async (event) => {
				const child = await this.dataSource.getRepository(Child).findOneBy({ id: event.childId });
				await this.notifications.createForUsers([event.parentUserId], {
					type: "LEAVE",
					title: event.decision === "APPROVED"
						? `Đơn xin nghỉ của ${child?.name ?? "trẻ"} đã được duyệt`
						: `Đơn xin nghỉ của ${child?.name ?? "trẻ"} bị từ chối`,
					content: event.decision === "REJECTED" ? `Lý do: ${event.reason ?? "Không có lý do"}` : `Nghỉ từ ${event.fromDate} đến ${event.toDate}.`,
					relatedType: "leave", relatedId: event.leaveRequestId,
				});
			}),
			this.events.subscribe("attendance.recorded", async (event) => {
				const parents = await this.dataSource.getRepository(ChildParent).find({
					where: { childId: event.childId }, select: { parentUserId: true },
				});
				const verb = event.action === "CHECK_OUT" ? "đã ra về" : event.action === "CHECK_IN" ? "đã đến lớp" : "được cập nhật điểm danh";
				await this.notifications.createForUsers([...new Set(parents.map(({ parentUserId }) => parentUserId))], {
					type: "ATTENDANCE", title: `Trẻ ${verb}`,
					content: `Ngày ${event.date}. Trạng thái: ${event.status}.`,
					relatedType: "attendance", relatedId: event.childId,
				});
			}),
		);
	}

	onModuleDestroy() {
		for (const unsubscribe of this.unsubscribers) unsubscribe();
	}
}
