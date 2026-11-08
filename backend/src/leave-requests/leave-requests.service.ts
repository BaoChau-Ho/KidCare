import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { ChildAccessService } from "../access/child-access.service";
import type { AccessActor } from "../access/child-access.service";
import { Child } from "../children/child.entity";
import { ClassTeacher } from "../classes/class-teacher.entity";
import { Classroom } from "../classes/class.entity";
import { DomainEventPublisher } from "../common/domain-events/domain-event.publisher";
import { isExclusionViolation } from "../common/db-errors";
import { daysBetween, isValidDateString, todayInSchool } from "../common/school-time";
import { User } from "../users/user.entity";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { ListLeaveRequestsQueryDto } from "./dto/list-leave-requests-query.dto";
import { LeaveRequest } from "./leave-request.entity";

type LeaveActor = AccessActor;

const MAX_SPAN_DAYS = 366; // chặn đơn nghỉ dài vô lý

@Injectable()
export class LeaveRequestsService {
	constructor(
		@InjectRepository(LeaveRequest)
		private readonly leaveRepository: Repository<LeaveRequest>,
		@InjectRepository(Child)
		private readonly childrenRepository: Repository<Child>,
		@InjectRepository(Classroom)
		private readonly classesRepository: Repository<Classroom>,
		@InjectRepository(User)
		private readonly usersRepository: Repository<User>,
		private readonly dataSource: DataSource,
		private readonly access: ChildAccessService,
		private readonly auditLogsService: AuditLogsService,
		private readonly events: DomainEventPublisher,
	) {}

	async create(dto: CreateLeaveRequestDto, actor: LeaveActor, ipAddress: string | null) {
		this.access.assertRole(actor, ["PARENT"], "Chỉ phụ huynh được gửi đơn xin nghỉ.");
		this.validateDates(dto.fromDate, dto.toDate);

		try {
			const { leave, child } = await this.dataSource.transaction(async (manager) => {
				// Khóa dòng của trẻ để các đơn gửi cùng lúc cho một trẻ được kiểm tra trùng tuần tự.
				const child = await manager.getRepository(Child).findOne({
					where: { id: dto.childId },
					lock: { mode: "pessimistic_write" },
				});
				if (!child) throw this.childNotFound();
				await this.access.assertIsParentOf(child.id, actor, manager);
				if (child.status !== "ACTIVE") {
					throw new ConflictException({ code: "CHILD_NOT_ACTIVE", message: "Trẻ không còn ở trạng thái đang học." });
				}

				const repository = manager.getRepository(LeaveRequest);
				const overlap = await repository.createQueryBuilder("leave")
					.where("leave.childId = :childId", { childId: child.id })
					.andWhere("leave.status IN ('PENDING', 'APPROVED')")
					.andWhere("leave.fromDate <= :toDate AND leave.toDate >= :fromDate", { fromDate: dto.fromDate, toDate: dto.toDate })
					.getOne();
				if (overlap) throw this.overlapError(overlap);

				const saved = await repository.save(repository.create({
					childId: child.id,
					parentUserId: actor.id,
					fromDate: dto.fromDate,
					toDate: dto.toDate,
					reason: dto.reason,
					status: "PENDING",
				}));
				await this.auditLogsService.record(manager, {
					actorUserId: actor.id,
					actorName: actor.fullName,
					action: "CREATE_LEAVE_REQUEST",
					resourceType: "leave_request",
					resourceId: saved.id,
					oldValue: null,
					newValue: { childId: child.id, fromDate: saved.fromDate, toDate: saved.toDate, status: saved.status },
					ipAddress,
				});
				return { leave: saved, child };
			});
			this.events.publish("leave-request.created", {
				leaveRequestId: leave.id,
				childId: child.id,
				classId: child.classId,
				parentUserId: actor.id,
				fromDate: leave.fromDate,
				toDate: leave.toDate,
			});
			return (await this.toResponses([leave]))[0];
		} catch (error) {
			if (isExclusionViolation(error)) {
				throw new ConflictException({
					code: "LEAVE_OVERLAP",
					message: "Đã có đơn nghỉ trùng với khoảng ngày này.",
					field: "fromDate",
				});
			}
			throw error;
		}
	}

	/** PARENT chỉ thấy đơn của mình; TEACHER thấy đơn của lớp được phân công; MANAGER thấy tất cả. */
	async list(query: ListLeaveRequestsQueryDto, actor: LeaveActor) {
		this.access.assertRole(actor, ["PARENT", "TEACHER", "MANAGER"], "Bạn không được xem đơn xin nghỉ.");
		const qb = this.leaveRepository.createQueryBuilder("leave")
			.innerJoin(Child, "child", "child.id = leave.childId");
		if (actor.role === "PARENT") {
			qb.andWhere("leave.parentUserId = :actorId", { actorId: actor.id });
		} else if (actor.role === "TEACHER") {
			qb.innerJoin(
				ClassTeacher,
				"assignment",
				"assignment.classId = child.classId AND assignment.teacherUserId = :actorId",
				{ actorId: actor.id },
			);
		}
		if (query.status) qb.andWhere("leave.status = :status", { status: query.status });
		if (query.childId) qb.andWhere("leave.childId = :childId", { childId: query.childId });
		if (query.classId) qb.andWhere("child.classId = :classId", { classId: query.classId });

		qb.orderBy("leave.createdAt", "DESC")
			.addOrderBy("leave.id", "ASC")
			.skip((query.page - 1) * query.limit)
			.take(query.limit);
		const [leaves, totalItems] = await qb.getManyAndCount();
		return {
			items: await this.toResponses(leaves),
			pageInfo: {
				page: query.page,
				limit: query.limit,
				totalItems,
				totalPages: Math.ceil(totalItems / query.limit),
			},
		};
	}

	approve(id: string, actor: LeaveActor, ipAddress: string | null) {
		return this.decide(id, "APPROVED", null, actor, ipAddress);
	}

	reject(id: string, reason: string, actor: LeaveActor, ipAddress: string | null) {
		return this.decide(id, "REJECTED", reason, actor, ipAddress);
	}

	/** Phụ huynh rút đơn khi còn PENDING. Đơn của người khác trả 404 để không lộ đơn có tồn tại. */
	async cancel(id: string, actor: LeaveActor, ipAddress: string | null) {
		this.access.assertRole(actor, ["PARENT"], "Chỉ phụ huynh được rút đơn xin nghỉ.");
		const leave = await this.dataSource.transaction(async (manager) => {
			const repository = manager.getRepository(LeaveRequest);
			const found = await repository.findOne({ where: { id, parentUserId: actor.id }, lock: { mode: "pessimistic_write" } });
			if (!found) throw this.leaveNotFound();
			if (found.status !== "PENDING") {
				throw new ConflictException({ code: "ALREADY_PROCESSED", message: "Chỉ rút được đơn đang chờ duyệt." });
			}
			found.status = "CANCELLED";
			const saved = await repository.save(found);
			await this.auditLogsService.record(manager, {
				actorUserId: actor.id,
				actorName: actor.fullName,
				action: "CANCEL_LEAVE_REQUEST",
				resourceType: "leave_request",
				resourceId: saved.id,
				oldValue: { status: "PENDING" },
				newValue: { status: "CANCELLED" },
				ipAddress,
			});
			return saved;
		});
		return (await this.toResponses([leave]))[0];
	}

	private async decide(
		id: string,
		decision: "APPROVED" | "REJECTED",
		reason: string | null,
		actor: LeaveActor,
		ipAddress: string | null,
	) {
		this.access.assertRole(actor, ["TEACHER", "MANAGER"], "Chỉ giáo viên và quản lý được xử lý đơn xin nghỉ.");
		const { leave, child } = await this.dataSource.transaction(async (manager) => {
			const repository = manager.getRepository(LeaveRequest);
			// Khóa dòng: hai giáo viên xử lý cùng một đơn thì chỉ một người thành công.
			const found = await repository.findOne({ where: { id }, lock: { mode: "pessimistic_write" } });
			if (!found) throw this.leaveNotFound();
			const child = await manager.getRepository(Child).findOneBy({ id: found.childId });
			if (!child) throw this.childNotFound();
			await this.access.assertCanAccessClass(child.classId, actor, manager);
			if (found.status !== "PENDING") {
				throw new ConflictException({ code: "ALREADY_PROCESSED", message: "Đơn này đã được xử lý." });
			}
			found.status = decision;
			found.decidedByUserId = actor.id;
			found.decidedAt = new Date();
			found.decisionReason = reason;
			const saved = await repository.save(found);
			await this.auditLogsService.record(manager, {
				actorUserId: actor.id,
				actorName: actor.fullName,
				action: decision === "APPROVED" ? "APPROVE_LEAVE_REQUEST" : "REJECT_LEAVE_REQUEST",
				resourceType: "leave_request",
				resourceId: saved.id,
				oldValue: { status: "PENDING" },
				newValue: { status: decision },
				ipAddress,
			});
			return { leave: saved, child };
		});
		this.events.publish("leave-request.decided", {
			leaveRequestId: leave.id,
			childId: child.id,
			classId: child.classId,
			parentUserId: leave.parentUserId,
			decision,
			decidedByUserId: actor.id,
			fromDate: leave.fromDate,
			toDate: leave.toDate,
			reason,
		});
		return (await this.toResponses([leave]))[0];
	}

	private validateDates(fromDate: string, toDate: string) {
		if (!isValidDateString(fromDate)) throw this.invalid("Ngày bắt đầu không hợp lệ.", "fromDate");
		if (!isValidDateString(toDate)) throw this.invalid("Ngày kết thúc không hợp lệ.", "toDate");
		if (fromDate < todayInSchool()) throw this.invalid("Không thể xin nghỉ cho ngày đã qua.", "fromDate");
		if (toDate < fromDate) throw this.invalid("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.", "toDate");
		if (daysBetween(fromDate, toDate) > MAX_SPAN_DAYS) throw this.invalid(`Đơn nghỉ tối đa ${MAX_SPAN_DAYS} ngày.`, "toDate");
	}

	/** Gắn tên trẻ, lớp, phụ huynh, người duyệt bằng vài truy vấn theo lô (tránh N+1). */
	private async toResponses(leaves: LeaveRequest[]) {
		if (leaves.length === 0) return [];
		const children = await this.childrenRepository.findBy({ id: In([...new Set(leaves.map((l) => l.childId))]) });
		const classes = children.length ? await this.classesRepository.findBy({ id: In([...new Set(children.map((c) => c.classId))]) }) : [];
		const userIds = [...new Set(leaves.flatMap((l) => (l.decidedByUserId ? [l.parentUserId, l.decidedByUserId] : [l.parentUserId])))];
		const users = await this.usersRepository.findBy({ id: In(userIds) });
		const childById = new Map(children.map((c) => [c.id, c]));
		const classById = new Map(classes.map((c) => [c.id, c]));
		const userById = new Map(users.map((u) => [u.id, u]));
		const nameOf = (id: string | null) => {
			const user = id ? userById.get(id) : undefined;
			return user ? (user.fullName ?? user.email) : null;
		};
		return leaves.map((leave) => {
			const child = childById.get(leave.childId);
			return {
				id: leave.id,
				childId: leave.childId,
				parentUserId: leave.parentUserId,
				fromDate: leave.fromDate,
				toDate: leave.toDate,
				reason: leave.reason,
				status: leave.status,
				decidedByUserId: leave.decidedByUserId,
				decidedAt: leave.decidedAt?.toISOString() ?? null,
				decisionReason: leave.decisionReason,
				createdAt: leave.createdAt.toISOString(),
				childName: child?.name ?? null,
				className: child ? (classById.get(child.classId)?.name ?? null) : null,
				parentName: nameOf(leave.parentUserId),
				decidedByName: nameOf(leave.decidedByUserId),
			};
		});
	}

	private overlapError(existing: LeaveRequest) {
		const fmt = (d: string) => d.split("-").reverse().join("/");
		return new ConflictException({
			code: "LEAVE_OVERLAP",
			message: `Đã có đơn nghỉ ${fmt(existing.fromDate)} - ${fmt(existing.toDate)} trùng với khoảng ngày này.`,
			field: "fromDate",
		});
	}

	private invalid(message: string, field: string) {
		return new BadRequestException({ code: "VALIDATION_ERROR", message, field });
	}

	private childNotFound() {
		return new NotFoundException({ code: "CHILD_NOT_FOUND", message: "Không tìm thấy hồ sơ trẻ." });
	}

	private leaveNotFound() {
		return new NotFoundException({ code: "LEAVE_REQUEST_NOT_FOUND", message: "Không tìm thấy đơn xin nghỉ." });
	}
}
