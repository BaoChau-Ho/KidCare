import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { ChildAccessService } from "../access/child-access.service";
import type { AccessActor } from "../access/child-access.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { AttendanceService } from "../attendance/attendance.service";
import { Child } from "../children/child.entity";
import { Classroom } from "../classes/class.entity";
import { ClassTeacher } from "../classes/class-teacher.entity";
import { isValidDateString, toSchoolDate } from "../common/school-time";
import { User } from "../users/user.entity";
import { NotificationsService } from "../notifications/notifications.service";
import { CreatePickupRequestDto } from "./dto/create-pickup-request.dto";
import { ListPickupRequestsQueryDto } from "./dto/list-pickup-requests-query.dto";
import { RejectPickupRequestDto } from "./dto/reject-pickup-request.dto";
import { PickupRequest } from "./pickup-request.entity";

const CLOCK_SKEW_MS = 60_000;

@Injectable()
export class PickupRequestsService {
	constructor(
		@InjectRepository(PickupRequest) private readonly requests: Repository<PickupRequest>,
		private readonly dataSource: DataSource,
		private readonly access: ChildAccessService,
		private readonly attendance: AttendanceService,
		private readonly audit: AuditLogsService,
		private readonly notifications: NotificationsService,
	) {}

	async create(dto: CreatePickupRequestDto, actor: AccessActor, ipAddress: string | null) {
		if (actor.role !== "PARENT") throw this.forbidden();
		const child = await this.dataSource.getRepository(Child).findOneBy({ id: dto.childId });
		if (!child) throw this.notFound("CHILD_NOT_FOUND", "Không tìm thấy hồ sơ trẻ.");
		await this.access.assertIsParentOf(child.id, actor);
		if (child.status !== "ACTIVE") throw new ConflictException({ code: "CHILD_NOT_ACTIVE", message: "Chỉ có thể tạo yêu cầu cho trẻ đang học." });
		const expectedTime = new Date(dto.expectedTime);
		if (Number.isNaN(expectedTime.getTime())) throw this.invalid("Thời gian đón không hợp lệ.", "expectedTime");
		if (expectedTime.getTime() < Date.now() - CLOCK_SKEW_MS) throw this.invalid("Thời gian đón không được ở quá khứ.", "expectedTime");
		const item = await this.dataSource.transaction(async (manager) => {
			const repo = manager.getRepository(PickupRequest);
			const created = await repo.save(repo.create({
				childId: child.id, requesterUserId: actor.id, pickupPerson: dto.pickupPerson.trim(), relationship: dto.relationship.trim(),
				idNumber: dto.idNumber.trim(), phone: dto.phone?.replace(/\s/g, "") || null, expectedTime, status: "PENDING",
				verifiedByTeacherUserId: null, decisionReason: null, decidedAt: null, completedAt: null,
			}));
			await this.audit.record(manager, { actorUserId: actor.id, actorName: actor.fullName, action: "CREATE_PICKUP_REQUEST", resourceType: "pickup_request", resourceId: created.id, newValue: { status: created.status }, ipAddress });
			const teachers = await manager.getRepository(ClassTeacher).find({
				where: { classId: child.classId }, select: { teacherUserId: true },
			});
			await this.notifications.createForUsers(teachers.map(({ teacherUserId }) => teacherUserId), {
				senderUserId: actor.id, type: "PICKUP", title: `Đăng ký người đón ${child.name}`,
				content: `Dự kiến ${expectedTime.toLocaleString("vi-VN")}.`, relatedType: "pickup", relatedId: created.id,
			}, manager);
			return created;
		});
		return this.toResponse(item, actor, child);
	}

	async list(query: ListPickupRequestsQueryDto, actor: AccessActor) {
		if (actor.role !== "PARENT" && actor.role !== "TEACHER") throw this.forbidden();
		if (query.date && !isValidDateString(query.date)) throw this.invalid("Ngày không hợp lệ.", "date");
		const qb = this.requests.createQueryBuilder("request").innerJoin(Child, "child", "child.id = request.child_id");
		if (actor.role === "PARENT") {
			qb.andWhere("request.requester_user_id = :actorId", { actorId: actor.id });
			if (query.classId) qb.andWhere("child.class_id = :classId", { classId: query.classId });
		} else {
			const classIds = await this.access.teacherClassIds(actor.id);
			if (query.classId && !classIds.includes(query.classId)) throw this.forbidden();
			if (query.classId) qb.andWhere("child.class_id = :classId", { classId: query.classId });
			else if (!classIds.length) qb.andWhere("1 = 0");
			else qb.andWhere("child.class_id IN (:...classIds)", { classIds });
		}
		if (query.date) qb.andWhere("CAST((request.expected_time AT TIME ZONE :schoolTimeZone) AS date) = :date", { date: query.date, schoolTimeZone: process.env.SCHOOL_TIME_ZONE ?? "Asia/Ho_Chi_Minh" });
		if (query.status) qb.andWhere("request.status = :status", { status: query.status });
		qb.orderBy("request.expectedTime", "ASC").addOrderBy("request.id", "ASC").skip((query.page - 1) * query.limit).take(query.limit);
		const [items, totalItems] = await qb.getManyAndCount();
		const response = await Promise.all(items.map(async (item) => {
			const child = await this.dataSource.getRepository(Child).findOneBy({ id: item.childId });
			return this.toResponse(item, actor, child);
		}));
		return { items: response, pageInfo: { page: query.page, limit: query.limit, totalItems, totalPages: Math.ceil(totalItems / query.limit) } };
	}

	cancel(id: string, actor: AccessActor, ipAddress: string | null) {
		return this.changeState(id, actor, ipAddress, "CANCEL_PICKUP_REQUEST", async (item) => {
			if (actor.role !== "PARENT") throw this.forbidden();
			if (item.requesterUserId !== actor.id) throw this.notFound("PICKUP_REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu đón trẻ.");
			if (item.status !== "PENDING") throw this.badState();
			item.status = "CANCELLED";
		});
	}

	approve(id: string, actor: AccessActor, ipAddress: string | null) {
		return this.changeState(id, actor, ipAddress, "APPROVE_PICKUP_REQUEST", async (item) => {
			await this.assertTeacherFor(item, actor);
			if (item.status !== "PENDING") throw this.badState();
			item.status = "APPROVED";
			item.verifiedByTeacherUserId = actor.id;
			item.decisionReason = null;
			item.decidedAt = new Date();
		});
	}

	reject(id: string, dto: RejectPickupRequestDto, actor: AccessActor, ipAddress: string | null) {
		return this.changeState(id, actor, ipAddress, "REJECT_PICKUP_REQUEST", async (item) => {
			await this.assertTeacherFor(item, actor);
			if (item.status !== "PENDING") throw this.badState();
			item.status = "REJECTED";
			item.verifiedByTeacherUserId = actor.id;
			item.decisionReason = dto.reason.trim();
			item.decidedAt = new Date();
		});
	}

	async complete(id: string, actor: AccessActor, ipAddress: string | null) {
		if (actor.role !== "TEACHER") throw this.forbidden();
		const saved = await this.dataSource.transaction(async (manager) => {
			const repo = manager.getRepository(PickupRequest);
			const item = await repo.findOne({ where: { id }, lock: { mode: "pessimistic_write" } });
			if (!item) throw this.notFound("PICKUP_REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu đón trẻ.");
			await this.assertTeacherFor(item, actor, manager);
			if (item.status !== "APPROVED") throw this.badState();
			const now = new Date();
			if (toSchoolDate(item.expectedTime) !== toSchoolDate(now)) throw new ConflictException({ code: "PICKUP_NOT_TODAY", message: "Chỉ hoàn tất yêu cầu đón của hôm nay." });
			const child = await manager.getRepository(Child).findOneBy({ id: item.childId });
			if (!child) throw this.notFound("CHILD_NOT_FOUND", "Không tìm thấy hồ sơ trẻ.");
			await this.attendance.recordCheckOut(manager, { child, date: toSchoolDate(now), checkOut: now, actor, ipAddress });
			const oldValue = { status: item.status };
			item.status = "COMPLETED";
			item.completedAt = now;
			const result = await repo.save(item);
			await this.audit.record(manager, { actorUserId: actor.id, actorName: actor.fullName, action: "COMPLETE_PICKUP_REQUEST", resourceType: "pickup_request", resourceId: item.id, oldValue, newValue: { status: result.status, completedAt: now.toISOString() }, ipAddress });
			await this.notifications.createForUsers([result.requesterUserId], {
				senderUserId: actor.id, type: "PICKUP", title: "Trẻ đã được giao cho người đón",
				content: `Trạng thái mới: ${result.status}.`, relatedType: "pickup", relatedId: result.id,
			}, manager);
			return result;
		});
		return this.toResponse(saved, actor);
	}

	private async changeState(id: string, actor: AccessActor, ipAddress: string | null, action: string, mutate: (item: PickupRequest, manager: import("typeorm").EntityManager) => Promise<void>) {
		const saved = await this.dataSource.transaction(async (manager) => {
			const repo = manager.getRepository(PickupRequest);
			const item = await repo.findOne({ where: { id }, lock: { mode: "pessimistic_write" } });
			if (!item) throw this.notFound("PICKUP_REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu đón trẻ.");
			const oldValue = { status: item.status };
			await mutate(item, manager);
			const result = await repo.save(item);
			const newValue: Record<string, unknown> = { status: result.status };
			if (result.decisionReason) newValue.decisionReason = result.decisionReason;
			await this.audit.record(manager, { actorUserId: actor.id, actorName: actor.fullName, action, resourceType: "pickup_request", resourceId: item.id, oldValue, newValue, ipAddress });
			if (actor.role === "TEACHER") {
				await this.notifications.createForUsers([result.requesterUserId], {
					senderUserId: actor.id, type: "PICKUP",
					title: result.status === "APPROVED" ? "Yêu cầu người đón đã được xác minh" : "Yêu cầu người đón bị từ chối",
					content: result.decisionReason ?? `Trạng thái mới: ${result.status}.`,
					relatedType: "pickup", relatedId: result.id,
				}, manager);
			}
			return result;
		});
		return this.toResponse(saved, actor);
	}

	private async assertTeacherFor(item: PickupRequest, actor: AccessActor, manager?: import("typeorm").EntityManager) {
		if (actor.role !== "TEACHER") throw this.forbidden();
		const child = await (manager ?? this.dataSource.manager).getRepository(Child).findOneBy({ id: item.childId });
		if (!child) throw this.notFound("CHILD_NOT_FOUND", "Không tìm thấy hồ sơ trẻ.");
		await this.access.assertCanAccessClass(child.classId, actor, manager);
	}

	private async toResponse(item: PickupRequest, actor: AccessActor, knownChild?: Child | null) {
		const [child, requester, verifier] = await Promise.all([
			knownChild === undefined ? this.dataSource.getRepository(Child).findOneBy({ id: item.childId }) : knownChild,
			this.dataSource.getRepository(User).findOne({ where: { id: item.requesterUserId }, select: { id: true, fullName: true } }),
			item.verifiedByTeacherUserId ? this.dataSource.getRepository(User).findOne({ where: { id: item.verifiedByTeacherUserId }, select: { id: true, fullName: true } }) : null,
		]);
		const classroom = child ? await this.dataSource.getRepository(Classroom).findOne({ where: { id: child.classId }, select: { id: true, name: true } }) : null;
		const canSeeFullId = actor.role === "TEACHER" && child ? await this.dataSource.getRepository(ClassTeacher).exist({ where: { classId: child.classId, teacherUserId: actor.id } }) : false;
		return {
			id: item.id, childId: item.childId, childName: child?.name ?? null, className: classroom?.name ?? null,
			requesterUserId: item.requesterUserId, requesterName: requester?.fullName ?? null,
			pickupPerson: item.pickupPerson, relationship: item.relationship,
			idNumber: canSeeFullId ? item.idNumber : `••••••${item.idNumber.slice(-4)}`,
			phone: item.phone, expectedTime: item.expectedTime.toISOString(), status: item.status,
			verifiedByTeacherUserId: item.verifiedByTeacherUserId, verifiedByName: verifier?.fullName ?? null,
			decisionReason: item.decisionReason, decidedAt: item.decidedAt?.toISOString() ?? null,
			completedAt: item.completedAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString(),
		};
	}

	private badState() { return new ConflictException({ code: "INVALID_PICKUP_TRANSITION", message: "Yêu cầu đón trẻ không ở trạng thái phù hợp để thực hiện thao tác này." }); }
	private forbidden() { return new ForbiddenException({ code: "ROLE_NOT_ALLOWED", message: "Bạn không có quyền thực hiện thao tác này." }); }
	private invalid(message: string, field: string) { return new BadRequestException({ code: "VALIDATION_ERROR", message, field }); }
	private notFound(code: string, message: string) { return new NotFoundException({ code, message }); }
}
