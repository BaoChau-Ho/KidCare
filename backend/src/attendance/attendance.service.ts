import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, Repository } from "typeorm";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { ChildAccessService } from "../access/child-access.service";
import type { AccessActor } from "../access/child-access.service";
import { Child } from "../children/child.entity";
import { Classroom } from "../classes/class.entity";
import { DomainEventPublisher } from "../common/domain-events/domain-event.publisher";
import { isUniqueViolation } from "../common/db-errors";
import {
	ATTENDANCE_END_TIME,
	ATTENDANCE_START_TIME,
	isValidDateString,
	toSchoolDate,
	todayInSchool,
} from "../common/school-time";
import { LeaveRequest } from "../leave-requests/leave-request.entity";
import { isEarlyLeave, statusForCheckIn } from "./attendance-policy";
import { Attendance } from "./attendance.entity";
import type { AttendanceStatus } from "./attendance.entity";
import { AttendanceHistoryQueryDto } from "./dto/attendance-history-query.dto";
import { CheckInDto } from "./dto/check-in.dto";
import { CheckOutDto } from "./dto/check-out.dto";
import { RosterQueryDto } from "./dto/roster-query.dto";
import { UpdateAttendanceDto } from "./dto/update-attendance.dto";

type AttendanceActor = AccessActor;

const CLOCK_SKEW_MS = 60_000; // cho phép đồng hồ thiết bị lệch tối đa 1 phút

@Injectable()
export class AttendanceService {
	constructor(
		@InjectRepository(Attendance)
		private readonly attendanceRepository: Repository<Attendance>,
		@InjectRepository(Child)
		private readonly childrenRepository: Repository<Child>,
		@InjectRepository(Classroom)
		private readonly classesRepository: Repository<Classroom>,
		@InjectRepository(LeaveRequest)
		private readonly leaveRepository: Repository<LeaveRequest>,
		private readonly dataSource: DataSource,
		private readonly access: ChildAccessService,
		private readonly auditLogsService: AuditLogsService,
		private readonly events: DomainEventPublisher,
	) {}

	/**
	 * Bảng điểm danh của lớp theo ngày, gồm cả trẻ chưa điểm danh.
	 * Không phân trang vì bị chặn bởi sĩ số lớp; các danh sách lịch sử thì có phân trang.
	 */
	async roster(classId: string, query: RosterQueryDto, actor: AttendanceActor) {
		this.access.assertRole(actor, ["TEACHER", "MANAGER"], "Chỉ giáo viên và quản lý được xem bảng điểm danh.");
		const classroom = await this.classesRepository.findOneBy({ id: classId });
		if (!classroom) throw this.classNotFound();
		await this.access.assertCanAccessClass(classroom.id, actor);
		const date = query.date ?? todayInSchool();
		this.assertDateString(date, "date");

		const children = await this.childrenRepository.find({
			where: { classId: classroom.id, status: "ACTIVE" },
			order: { name: "ASC", id: "ASC" },
		});
		const childIds = children.map((child) => child.id);
		const records = childIds.length ? await this.attendanceRepository.findBy({ date, childId: In(childIds) }) : [];
		const leaves = childIds.length
			? await this.leaveRepository.createQueryBuilder("leave")
				.where("leave.childId IN (:...childIds)", { childIds })
				.andWhere("leave.status = 'APPROVED'")
				.andWhere("leave.fromDate <= :date AND leave.toDate >= :date", { date })
				.getMany()
			: [];
		const recordByChild = new Map(records.map((record) => [record.childId, record]));
		const onLeave = new Set(leaves.map((leave) => leave.childId));

		return {
			classId: classroom.id,
			className: classroom.name,
			date,
			settings: { startTime: ATTENDANCE_START_TIME, endTime: ATTENDANCE_END_TIME },
			items: children.map((child) => {
				const record = recordByChild.get(child.id);
				return {
					childId: child.id,
					name: child.name,
					gender: child.gender,
					attendanceId: record?.id ?? null,
					// Trẻ có đơn nghỉ đã duyệt và chưa có bản ghi hiện là ABSENT (nghỉ có phép)
					status: record ? record.status : onLeave.has(child.id) ? "ABSENT" : "NOT_CHECKED_IN",
					checkInTime: record?.checkInTime?.toISOString() ?? null,
					checkOutTime: record?.checkOutTime?.toISOString() ?? null,
					earlyLeave: record ? this.earlyLeaveOf(record) : false,
					onLeave: onLeave.has(child.id),
				};
			}),
		};
	}

	async checkIn(dto: CheckInDto, actor: AttendanceActor, ipAddress: string | null) {
		this.access.assertRole(actor, ["TEACHER", "MANAGER"], "Chỉ giáo viên và quản lý được điểm danh.");
		const now = new Date();
		const absent = dto.status === "ABSENT";
		if (absent && dto.checkInTime) throw this.invalid("Ghi vắng không kèm giờ đến.", "checkInTime");

		const given = dto.checkInTime ? this.parseInstant(dto.checkInTime, "checkInTime") : null;
		const date = dto.date ?? (given ? toSchoolDate(given) : todayInSchool(now));
		this.assertAttendanceDate(date, now);
		if (given && toSchoolDate(given) !== date) throw this.invalid("Giờ đến phải thuộc ngày điểm danh.", "checkInTime");

		let checkIn: Date | null = null;
		if (!absent) {
			checkIn = given ?? (date === todayInSchool(now) ? now : null);
			if (!checkIn) throw this.invalid("Nhập giờ đến cho ngày đã qua.", "checkInTime");
			this.assertNotFuture(checkIn, now, "Giờ đến không được ở tương lai.", "checkInTime");
		}

		try {
			const { record, child } = await this.dataSource.transaction(async (manager) => {
				const child = await manager.getRepository(Child).findOne({
					where: { id: dto.childId },
					lock: { mode: "pessimistic_read" },
				});
				if (!child) throw this.childNotFound();
				await this.access.assertCanAccessClass(child.classId, actor, manager);
				if (child.status !== "ACTIVE") throw this.childNotActive();

				const repository = manager.getRepository(Attendance);
				if (await repository.exist({ where: { childId: child.id, date } })) throw this.alreadyRecorded();

				const saved = await repository.save(repository.create({
					childId: child.id,
					date,
					status: absent || !checkIn ? "ABSENT" : statusForCheckIn(checkIn),
					checkInTime: checkIn,
					checkOutTime: null,
					recordedByUserId: actor.id,
					checkedOutByUserId: null,
				}));
				await this.auditLogsService.record(manager, {
					actorUserId: actor.id,
					actorName: actor.fullName,
					action: absent ? "MARK_ABSENT" : "CHECK_IN",
					resourceType: "attendance",
					resourceId: saved.id,
					oldValue: null,
					newValue: { childId: child.id, date, status: saved.status, checkInTime: saved.checkInTime?.toISOString() ?? null },
					ipAddress,
				});
				return { record: saved, child };
			});
			this.events.publish("attendance.recorded", {
				attendanceId: record.id,
				childId: child.id,
				classId: child.classId,
				date,
				action: absent ? "MARK_ABSENT" : "CHECK_IN",
				status: record.status,
				actorUserId: actor.id,
			});
			return this.toResponse(record);
		} catch (error) {
			// Hai request cùng lúc: một bên thắng, bên kia nhận lỗi trùng rõ ràng thay vì 500.
			if (isUniqueViolation(error)) throw this.alreadyRecorded();
			throw error;
		}
	}

	async checkOut(dto: CheckOutDto, actor: AttendanceActor, ipAddress: string | null) {
		this.access.assertRole(actor, ["TEACHER", "MANAGER"], "Chỉ giáo viên và quản lý được điểm danh.");
		const now = new Date();
		const given = dto.checkOutTime ? this.parseInstant(dto.checkOutTime, "checkOutTime") : null;
		const date = dto.date ?? (given ? toSchoolDate(given) : todayInSchool(now));
		this.assertAttendanceDate(date, now);
		if (given && toSchoolDate(given) !== date) throw this.invalid("Giờ về phải thuộc ngày điểm danh.", "checkOutTime");
		const checkOut = given ?? (date === todayInSchool(now) ? now : null);
		if (!checkOut) throw this.invalid("Nhập giờ về cho ngày đã qua.", "checkOutTime");
		this.assertNotFuture(checkOut, now, "Giờ về không được ở tương lai.", "checkOutTime");

		const { record, child } = await this.dataSource.transaction(async (manager) => {
			const child = await manager.getRepository(Child).findOneBy({ id: dto.childId });
			if (!child) throw this.childNotFound();
			await this.access.assertCanAccessClass(child.classId, actor, manager);
			const record = await this.recordCheckOut(manager, { child, date, checkOut, actor, ipAddress });
			return { record, child };
		});
		this.events.publish("attendance.recorded", {
			attendanceId: record.id,
			childId: child.id,
			classId: child.classId,
			date,
			action: "CHECK_OUT",
			status: record.status,
			actorUserId: actor.id,
		});
		return this.toResponse(record);
	}

	/**
	 * Ghi check-out trong một transaction có sẵn. Stage 5 (hoàn tất đón trẻ) gọi hàm này trong CÙNG transaction
	 * với việc đổi trạng thái PickupRequest để check-out và COMPLETED luôn đi cùng nhau, và chỉ xảy ra một lần.
	 * Người gọi chịu trách nhiệm kiểm tra quyền trên lớp của trẻ.
	 */
	async recordCheckOut(
		manager: EntityManager,
		input: { child: Child; date: string; checkOut: Date; actor: AttendanceActor; ipAddress: string | null },
	): Promise<Attendance> {
		const { child, date, checkOut, actor, ipAddress } = input;
		const repository = manager.getRepository(Attendance);
		// Khóa dòng để hai lần check-out/hoàn tất đồng thời được xử lý tuần tự.
		const record = await repository.findOne({ where: { childId: child.id, date }, lock: { mode: "pessimistic_write" } });
		if (!record || record.status === "ABSENT" || !record.checkInTime) {
			throw new ConflictException({ code: "NOT_CHECKED_IN", message: "Trẻ chưa được check-in nên không thể check-out." });
		}
		if (record.checkOutTime) {
			throw new ConflictException({ code: "ALREADY_CHECKED_OUT", message: "Trẻ đã được check-out." });
		}
		if (checkOut.getTime() < record.checkInTime.getTime()) {
			throw this.invalid("Giờ về phải sau giờ đến.", "checkOutTime");
		}
		record.checkOutTime = checkOut;
		record.checkedOutByUserId = actor.id;
		const saved = await repository.save(record);
		await this.auditLogsService.record(manager, {
			actorUserId: actor.id,
			actorName: actor.fullName,
			action: "CHECK_OUT",
			resourceType: "attendance",
			resourceId: saved.id,
			oldValue: { checkOutTime: null },
			newValue: { checkOutTime: checkOut.toISOString() },
			ipAddress,
		});
		return saved;
	}

	async update(id: string, dto: UpdateAttendanceDto, actor: AttendanceActor, ipAddress: string | null) {
		this.access.assertRole(actor, ["TEACHER", "MANAGER"], "Chỉ giáo viên và quản lý được sửa điểm danh.");
		if (dto.status === undefined && dto.checkInTime === undefined && dto.checkOutTime === undefined) {
			throw new BadRequestException({ code: "EMPTY_UPDATE", message: "Hãy cung cấp thông tin cần cập nhật." });
		}
		const now = new Date();

		const { record, child, before } = await this.dataSource.transaction(async (manager) => {
			const repository = manager.getRepository(Attendance);
			const record = await repository.findOne({ where: { id }, lock: { mode: "pessimistic_write" } });
			if (!record) throw this.attendanceNotFound();
			const child = await manager.getRepository(Child).findOneBy({ id: record.childId });
			if (!child) throw this.childNotFound();
			await this.access.assertCanAccessClass(child.classId, actor, manager);

			const snapshot = (r: Attendance) => ({
				status: r.status,
				checkInTime: r.checkInTime?.toISOString() ?? null,
				checkOutTime: r.checkOutTime?.toISOString() ?? null,
			});
			const before = snapshot(record);

			let status: AttendanceStatus = dto.status ?? record.status;
			let checkIn = dto.checkInTime === undefined ? record.checkInTime : dto.checkInTime === null ? null : this.parseInstant(dto.checkInTime, "checkInTime");
			let checkOut = dto.checkOutTime === undefined ? record.checkOutTime : dto.checkOutTime === null ? null : this.parseInstant(dto.checkOutTime, "checkOutTime");

			if (status === "ABSENT") {
				if (dto.checkInTime || dto.checkOutTime) throw this.invalid("Bản ghi vắng không có giờ đến hoặc giờ về.", "status");
				checkIn = null;
				checkOut = null;
			} else {
				if (!checkIn) throw this.invalid("Nhập giờ đến.", "checkInTime");
				if (toSchoolDate(checkIn) !== record.date) throw this.invalid("Giờ đến phải thuộc ngày điểm danh.", "checkInTime");
				if (checkOut) {
					if (toSchoolDate(checkOut) !== record.date) throw this.invalid("Giờ về phải thuộc ngày điểm danh.", "checkOutTime");
					if (checkOut.getTime() < checkIn.getTime()) throw this.invalid("Giờ về phải sau giờ đến.", "checkOutTime");
				}
				this.assertNotFuture(checkIn, now, "Giờ đến không được ở tương lai.", "checkInTime");
				if (checkOut) this.assertNotFuture(checkOut, now, "Giờ về không được ở tương lai.", "checkOutTime");
				// Có mặt/đi muộn luôn được tính lại từ giờ đến; chỉ EARLY_LEAVE do người dùng chọn được giữ nguyên.
				if (dto.status === undefined || status === "PRESENT" || status === "LATE") status = statusForCheckIn(checkIn);
			}

			record.status = status;
			record.checkInTime = checkIn;
			record.checkOutTime = checkOut;
			const saved = await repository.save(record);
			const after = snapshot(saved);
			if (JSON.stringify(before) !== JSON.stringify(after)) {
				await this.auditLogsService.record(manager, {
					actorUserId: actor.id,
					actorName: actor.fullName,
					action: "UPDATE_ATTENDANCE",
					resourceType: "attendance",
					resourceId: saved.id,
					oldValue: before,
					newValue: after,
					ipAddress,
				});
			}
			return { record: saved, child, before };
		});
		if (before.status !== record.status || before.checkInTime !== (record.checkInTime?.toISOString() ?? null) || before.checkOutTime !== (record.checkOutTime?.toISOString() ?? null)) {
			this.events.publish("attendance.recorded", {
				attendanceId: record.id,
				childId: child.id,
				classId: child.classId,
				date: record.date,
				action: "UPDATE",
				status: record.status,
				actorUserId: actor.id,
			});
		}
		return this.toResponse(record);
	}

	/** UC-07: trạng thái hôm nay của một bé (phụ huynh đã liên kết, giáo viên của lớp, quản lý). */
	async today(childId: string, actor: AttendanceActor) {
		const child = await this.findChild(childId);
		await this.access.assertCanViewChild(child, actor);
		const date = todayInSchool();
		const record = await this.attendanceRepository.findOneBy({ childId: child.id, date });
		const onLeave = await this.leaveRepository.createQueryBuilder("leave")
			.where("leave.childId = :childId", { childId: child.id })
			.andWhere("leave.status = 'APPROVED'")
			.andWhere("leave.fromDate <= :date AND leave.toDate >= :date", { date })
			.getExists();
		return {
			childId: child.id,
			date,
			status: record ? record.status : onLeave ? "ABSENT" : "NOT_CHECKED_IN",
			checkInTime: record?.checkInTime?.toISOString() ?? null,
			checkOutTime: record?.checkOutTime?.toISOString() ?? null,
			earlyLeave: record ? this.earlyLeaveOf(record) : false,
			onLeave,
		};
	}

	/** UC-07: lịch sử điểm danh theo khoảng ngày, có phân trang, mới nhất trước. */
	async history(childId: string, query: AttendanceHistoryQueryDto, actor: AttendanceActor) {
		const child = await this.findChild(childId);
		await this.access.assertCanViewChild(child, actor);
		if (query.from) this.assertDateString(query.from, "from");
		if (query.to) this.assertDateString(query.to, "to");
		if (query.from && query.to && query.from > query.to) {
			throw this.invalid("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.", "from");
		}

		const qb = this.attendanceRepository.createQueryBuilder("attendance").where("attendance.childId = :childId", { childId: child.id });
		if (query.from) qb.andWhere("attendance.date >= :from", { from: query.from });
		if (query.to) qb.andWhere("attendance.date <= :to", { to: query.to });
		qb.orderBy("attendance.date", "DESC")
			.addOrderBy("attendance.id", "ASC")
			.skip((query.page - 1) * query.limit)
			.take(query.limit);
		const [records, totalItems] = await qb.getManyAndCount();
		return {
			items: records.map((record) => this.toResponse(record)),
			pageInfo: {
				page: query.page,
				limit: query.limit,
				totalItems,
				totalPages: Math.ceil(totalItems / query.limit),
			},
		};
	}

	private toResponse(record: Attendance) {
		return {
			id: record.id,
			childId: record.childId,
			date: record.date,
			status: record.status,
			checkInTime: record.checkInTime?.toISOString() ?? null,
			checkOutTime: record.checkOutTime?.toISOString() ?? null,
			recordedByUserId: record.recordedByUserId,
			earlyLeave: this.earlyLeaveOf(record),
			createdAt: record.createdAt.toISOString(),
			updatedAt: record.updatedAt.toISOString(),
		};
	}

	private earlyLeaveOf(record: Attendance) {
		return record.status !== "ABSENT" && isEarlyLeave(record.checkOutTime);
	}

	private async findChild(id: string) {
		const child = await this.childrenRepository.findOneBy({ id });
		if (!child) throw this.childNotFound();
		return child;
	}

	private parseInstant(value: string, field: string): Date {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) throw this.invalid("Thời điểm không hợp lệ.", field);
		return date;
	}

	private assertDateString(value: string, field: string) {
		if (!isValidDateString(value)) throw this.invalid("Ngày không hợp lệ.", field);
	}

	private assertAttendanceDate(date: string, now: Date) {
		this.assertDateString(date, "date");
		if (date > todayInSchool(now)) throw this.invalid("Không thể điểm danh cho ngày trong tương lai.", "date");
	}

	private assertNotFuture(time: Date, now: Date, message: string, field: string) {
		if (time.getTime() > now.getTime() + CLOCK_SKEW_MS) throw this.invalid(message, field);
	}

	private invalid(message: string, field: string) {
		return new BadRequestException({ code: "VALIDATION_ERROR", message, field });
	}

	private childNotFound() {
		return new NotFoundException({ code: "CHILD_NOT_FOUND", message: "Không tìm thấy hồ sơ trẻ." });
	}

	private classNotFound() {
		return new NotFoundException({ code: "CLASS_NOT_FOUND", message: "Không tìm thấy lớp." });
	}

	private attendanceNotFound() {
		return new NotFoundException({ code: "ATTENDANCE_NOT_FOUND", message: "Không tìm thấy bản ghi điểm danh." });
	}

	private childNotActive() {
		return new ConflictException({ code: "CHILD_NOT_ACTIVE", message: "Trẻ không còn ở trạng thái đang học." });
	}

	private alreadyRecorded() {
		return new ConflictException({
			code: "ATTENDANCE_EXISTS",
			message: "Trẻ đã có bản ghi điểm danh trong ngày này. Hãy dùng chức năng sửa.",
		});
	}
}
