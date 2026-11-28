import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DataSource, In, Repository } from "typeorm";
import { ChildAccessService } from "../access/child-access.service";
import type { AccessActor } from "../access/child-access.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { Child } from "../children/child.entity";
import { Classroom } from "../classes/class.entity";
import { isValidDateString, todayInSchool } from "../common/school-time";
import { User } from "../users/user.entity";
import { ActivityImage } from "./activity-image.entity";
import { ActivityParticipant } from "./activity-participant.entity";
import { Activity } from "./activity.entity";
import { CreateActivityDto } from "./dto/create-activity.dto";
import { ListActivitiesQueryDto } from "./dto/list-activities-query.dto";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_ROOT = resolve(process.env.ACTIVITY_UPLOAD_DIR ?? join(process.cwd(), "uploads", "activities"));
export type ActivityUploadFile = { buffer: Buffer; size: number; originalname: string };

@Injectable()
export class ActivitiesService {
	constructor(
		@InjectRepository(Activity) private readonly activities: Repository<Activity>,
		private readonly dataSource: DataSource,
		private readonly access: ChildAccessService,
		private readonly audit: AuditLogsService,
	) {}

	async create(dto: CreateActivityDto, actor: AccessActor, ipAddress: string | null) {
		if (actor.role !== "TEACHER") throw this.forbidden();
		const classroom = await this.dataSource.getRepository(Classroom).findOneBy({ id: dto.classId });
		if (!classroom) throw this.notFound("CLASS_NOT_FOUND", "Không tìm thấy lớp.");
		await this.access.assertCanAccessClass(classroom.id, actor);
		if (classroom.status !== "ACTIVE") throw new ConflictException({ code: "CLASS_CLOSED", message: "Không thể tạo hoạt động cho lớp đã đóng." });
		const date = dto.date;
		if (!isValidDateString(date)) throw this.invalid("Ngày hoạt động không hợp lệ.", "date");
		if (date > todayInSchool()) throw this.invalid("Ngày hoạt động không được ở tương lai.", "date");
		const participants = this.dedupe(dto.participants ?? []);
		await this.assertParticipants(classroom.id, participants.map((p) => p.childId));
		const saved = await this.dataSource.transaction(async (manager) => {
			const activityRepo = manager.getRepository(Activity);
			const activity = await activityRepo.save(activityRepo.create({
				classId: classroom.id, createdByTeacherUserId: actor.id, title: dto.title.trim(),
				description: dto.description?.trim() || null, date,
			}));
			if (participants.length) await manager.getRepository(ActivityParticipant).save(participants.map((p) => manager.getRepository(ActivityParticipant).create({ childId: p.childId, participationStatus: p.participationStatus, activityId: activity.id })));
			await this.audit.record(manager, { actorUserId: actor.id, actorName: actor.fullName, action: "CREATE_ACTIVITY", resourceType: "activity", resourceId: activity.id, newValue: { classId: activity.classId, title: activity.title, date: activity.date }, ipAddress });
			return activity;
		});
		return this.toResponse(saved);
	}

	async list(query: ListActivitiesQueryDto, actor: AccessActor) {
		if (actor.role !== "TEACHER" && actor.role !== "MANAGER") throw this.forbidden();
		const qb = this.activities.createQueryBuilder("activity");
		if (actor.role === "TEACHER") {
			const classIds = await this.access.teacherClassIds(actor.id);
			if (query.classId && !classIds.includes(query.classId)) throw this.forbidden();
			if (query.classId) qb.andWhere("activity.classId = :classId", { classId: query.classId });
			else if (!classIds.length) qb.andWhere("1 = 0");
			else qb.andWhere("activity.classId IN (:...classIds)", { classIds });
		} else if (query.classId) qb.andWhere("activity.classId = :classId", { classId: query.classId });
		if (query.date) {
			if (!isValidDateString(query.date)) throw this.invalid("Ngày không hợp lệ.", "date");
			qb.andWhere("activity.date = :date", { date: query.date });
		}
		qb.orderBy("activity.date", "DESC").addOrderBy("activity.createdAt", "DESC").addOrderBy("activity.id", "DESC")
			.skip((query.page - 1) * query.limit).take(query.limit);
		const [items, totalItems] = await qb.getManyAndCount();
		return { items: await Promise.all(items.map((item) => this.toResponse(item))), pageInfo: this.pageInfo(query.page, query.limit, totalItems) };
	}

	async addParticipants(activityId: string, input: { childId: string; participationStatus: "JOINED" | "NOT_JOINED" }[], actor: AccessActor, ipAddress: string | null) {
		if (actor.role !== "TEACHER") throw this.forbidden();
		const result = await this.dataSource.transaction(async (manager) => {
			const activity = await manager.getRepository(Activity).findOne({ where: { id: activityId }, lock: { mode: "pessimistic_write" } });
			if (!activity) throw this.notFound("ACTIVITY_NOT_FOUND", "Không tìm thấy hoạt động.");
			await this.access.assertCanAccessClass(activity.classId, actor, manager);
			const participants = this.dedupe(input);
			await this.assertParticipants(activity.classId, participants.map((p) => p.childId), manager);
			const repo = manager.getRepository(ActivityParticipant);
			for (const participant of participants) await repo.save(repo.create({ childId: participant.childId, participationStatus: participant.participationStatus, activityId }));
			await this.audit.record(manager, { actorUserId: actor.id, actorName: actor.fullName, action: "UPDATE_ACTIVITY_PARTICIPANTS", resourceType: "activity", resourceId: activityId, newValue: { childIds: participants.map((p) => p.childId) }, ipAddress });
			return repo.findBy({ activityId });
		});
		return this.participantResponses(result);
	}

	async uploadImage(activityId: string, file: ActivityUploadFile | undefined, actor: AccessActor, ipAddress: string | null) {
		if (actor.role !== "TEACHER") throw this.forbidden();
		if (!file?.buffer?.length) throw this.invalid("Cần gửi file ảnh ở trường 'file'.", "file");
		if (file.size > MAX_IMAGE_BYTES) throw new ConflictException({ code: "FILE_TOO_LARGE", message: "Ảnh vượt quá 2 MB." });
		const imageType = this.detectImage(file.buffer);
		if (!imageType) throw this.invalid("Chỉ nhận ảnh JPEG, PNG hoặc WEBP hợp lệ.", "file");
		return this.dataSource.transaction(async (manager) => {
			const activityRepo = manager.getRepository(Activity);
			const activity = await activityRepo.findOne({ where: { id: activityId }, lock: { mode: "pessimistic_write" } });
			if (!activity) throw this.notFound("ACTIVITY_NOT_FOUND", "Không tìm thấy hoạt động.");
			await this.access.assertCanAccessClass(activity.classId, actor, manager);
			const imageRepo = manager.getRepository(ActivityImage);
			if (await imageRepo.countBy({ activityId }) >= 6) throw new ConflictException({ code: "ACTIVITY_IMAGE_LIMIT", message: "Mỗi hoạt động chỉ được có tối đa 6 ảnh." });
			const id = randomUUID();
			const objectKey = `${activityId}/${id}.${imageType.extension}`;
			const target = this.imagePath(objectKey);
			await mkdir(join(IMAGE_ROOT, activityId), { recursive: true });
			await writeFile(target, file.buffer, { flag: "wx" });
			try {
				const image = await imageRepo.save(imageRepo.create({ id, activityId, objectKey, mimeType: imageType.mime, name: file.originalname?.slice(0, 255) || null }));
				await this.audit.record(manager, { actorUserId: actor.id, actorName: actor.fullName, action: "UPLOAD_ACTIVITY_IMAGE", resourceType: "activity", resourceId: activityId, newValue: { imageId: image.id, mimeType: image.mimeType }, ipAddress });
				return this.imageResponse(image);
			} catch (error) {
				const { unlink } = await import("node:fs/promises");
				await unlink(target).catch(() => undefined);
				throw error;
			}
		});
	}

	async getImage(activityId: string, imageId: string) {
		const image = await this.dataSource.getRepository(ActivityImage).findOneBy({ id: imageId, activityId });
		if (!image) throw this.notFound("ACTIVITY_IMAGE_NOT_FOUND", "Không tìm thấy ảnh.");
		return { buffer: await readFile(this.imagePath(image.objectKey)), mimeType: image.mimeType };
	}

	async childActivities(childId: string, page: number, limit: number, actor: AccessActor) {
		const child = await this.dataSource.getRepository(Child).findOneBy({ id: childId });
		if (!child) throw this.notFound("CHILD_NOT_FOUND", "Không tìm thấy hồ sơ trẻ.");
		await this.access.assertCanViewChild(child, actor);
		const qb = this.activities.createQueryBuilder("activity")
			.innerJoin(ActivityParticipant, "participant", "participant.activity_id = activity.id AND participant.child_id = :childId AND participant.participation_status = 'JOINED'", { childId })
			.addSelect("(SELECT COUNT(*)::int FROM activity_participants ap WHERE ap.activity_id = activity.id AND ap.participation_status = 'JOINED')", "participantCount")
			.where("activity.classId = :classId", { classId: child.classId })
			.orderBy("activity.date", "DESC").addOrderBy("activity.createdAt", "DESC").addOrderBy("activity.id", "DESC")
			.skip((page - 1) * limit).take(limit);
		const [activities, totalItems] = await qb.getManyAndCount();
		const items = await Promise.all(activities.map(async (activity) => {
			const [classroom, teacher, images] = await Promise.all([
				this.dataSource.getRepository(Classroom).findOne({ where: { id: activity.classId }, select: { id: true, name: true } }),
				this.dataSource.getRepository(User).findOne({ where: { id: activity.createdByTeacherUserId }, select: { id: true, fullName: true } }),
				this.dataSource.getRepository(ActivityImage).find({ where: { activityId: activity.id }, order: { createdAt: "ASC", id: "ASC" } }),
			]);
			const participantCount = await this.dataSource.getRepository(ActivityParticipant).countBy({ activityId: activity.id, participationStatus: "JOINED" });
			return { id: activity.id, classId: activity.classId, className: classroom?.name ?? null, createdByName: teacher?.fullName ?? null, title: activity.title, description: activity.description, date: activity.date, participantCount, images: images.map((image) => this.imageResponse(image)) };
		}));
		return { items, pageInfo: this.pageInfo(page, limit, totalItems) };
	}

	private async assertParticipants(classId: string, childIds: string[], manager = this.dataSource.manager) {
		if (!childIds.length) return;
		const children = await manager.getRepository(Child).findBy({ id: In(childIds) });
		if (children.length !== childIds.length || children.some((child) => child.classId !== classId || child.status !== "ACTIVE")) {
			throw this.invalid("Mọi trẻ tham gia phải đang học trong lớp của hoạt động.", "participants");
		}
	}

	private dedupe<T extends { childId: string }>(items: T[]): T[] {
		return [...new Map(items.map((item) => [item.childId, item])).values()];
	}

	private async toResponse(activity: Activity) {
		const [classroom, teacher, participants, images] = await Promise.all([
			this.dataSource.getRepository(Classroom).findOne({ where: { id: activity.classId }, select: { id: true, name: true } }),
			this.dataSource.getRepository(User).findOne({ where: { id: activity.createdByTeacherUserId }, select: { id: true, fullName: true } }),
			this.dataSource.getRepository(ActivityParticipant).find({ where: { activityId: activity.id }, order: { childId: "ASC" } }),
			this.dataSource.getRepository(ActivityImage).find({ where: { activityId: activity.id }, order: { createdAt: "ASC", id: "ASC" } }),
		]);
		const participantResponses = await this.participantResponses(participants);
		return { id: activity.id, classId: activity.classId, className: classroom?.name ?? null, createdByTeacherUserId: activity.createdByTeacherUserId, createdByName: teacher?.fullName ?? null, title: activity.title, description: activity.description, date: activity.date, createdAt: activity.createdAt.toISOString(), participants: participantResponses, images: images.map((image) => this.imageResponse(image)) };
	}

	private async participantResponses(items: ActivityParticipant[]) {
		const children = items.length ? await this.dataSource.getRepository(Child).find({ where: { id: In(items.map((item) => item.childId)) }, select: { id: true, name: true } }) : [];
		const names = new Map(children.map((child) => [child.id, child.name]));
		return items.map((item) => ({ activityId: item.activityId, childId: item.childId, participationStatus: item.participationStatus, childName: names.get(item.childId) ?? null }));
	}

	private imageResponse(image: ActivityImage) {
		const path = `/uploads/activities/${image.activityId}/${image.id}`;
		const base = process.env.PUBLIC_API_URL ?? "http://localhost:3000";
		return { id: image.id, objectKey: image.objectKey, url: new URL(path, base).toString(), name: image.name };
	}
	private imagePath(objectKey: string) {
		const target = resolve(IMAGE_ROOT, objectKey);
		if (!target.startsWith(`${IMAGE_ROOT}${process.platform === "win32" ? "\\" : "/"}`)) throw this.invalid("Đường dẫn ảnh không hợp lệ.", "file");
		return target;
	}
	private detectImage(buffer: Buffer): { mime: string; extension: string } | null {
		if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mime: "image/png", extension: "png" };
		if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: "image/jpeg", extension: "jpg" };
		if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return { mime: "image/webp", extension: "webp" };
		return null;
	}
	private pageInfo(page: number, limit: number, totalItems: number) { return { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) }; }
	private invalid(message: string, field: string) { return new BadRequestException({ code: "VALIDATION_ERROR", message, field }); }
	private forbidden() { return new ForbiddenException({ code: "ROLE_NOT_ALLOWED", message: "Bạn không có quyền thực hiện thao tác này." }); }
	private notFound(code: string, message: string) { return new NotFoundException({ code, message }); }
}
