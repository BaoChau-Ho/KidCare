import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { ClassTeacher } from "../classes/class-teacher.entity";
import { Classroom } from "../classes/class.entity";
import { User } from "../users/user.entity";
import { ChildParent } from "./child-parent.entity";
import { Child } from "./child.entity";
import { CreateChildDto } from "./dto/create-child.dto";
import { LinkParentDto } from "./dto/link-parent.dto";
import { ListChildrenQueryDto } from "./dto/list-children-query.dto";
import { UpdateChildDto } from "./dto/update-child.dto";

type ChildActor = Pick<User, "id" | "email" | "fullName" | "role">;

function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "23505"
	);
}

@Injectable()
export class ChildrenService {
	constructor(
		@InjectRepository(Child)
		private readonly childrenRepository: Repository<Child>,
		@InjectRepository(ChildParent)
		private readonly childParentsRepository: Repository<ChildParent>,
		private readonly dataSource: DataSource,
		private readonly auditLogsService: AuditLogsService,
	) {}

	async list(query: ListChildrenQueryDto, actor: ChildActor) {
		const qb = this.childrenRepository.createQueryBuilder("child");
		if (query.query) {
			qb.andWhere("LOWER(child.name) LIKE :search", {
				search: `%${query.query.toLowerCase()}%`,
			});
		}
		if (query.classId) qb.andWhere("child.classId = :classId", { classId: query.classId });
		if (query.status) qb.andWhere("child.status = :status", { status: query.status });

		if (actor.role === "TEACHER") {
			qb.innerJoin(
				ClassTeacher,
				"assignment",
				"assignment.classId = child.classId AND assignment.teacherUserId = :actorId",
				{ actorId: actor.id },
			);
		} else if (actor.role === "PARENT") {
			qb.innerJoin(
				ChildParent,
				"parentLink",
				"parentLink.childId = child.id AND parentLink.parentUserId = :actorId",
				{ actorId: actor.id },
			);
		} else if (actor.role !== "MANAGER") {
			throw this.accessDenied();
		}

		qb.orderBy("child.name", "ASC")
			.addOrderBy("child.id", "ASC")
			.skip((query.page - 1) * query.limit)
			.take(query.limit);
		const [children, totalItems] = await qb.getManyAndCount();
		const items = await Promise.all(children.map((child) => this.toResponse(child)));

		return {
			items,
			pageInfo: {
				page: query.page,
				limit: query.limit,
				totalItems,
				totalPages: Math.ceil(totalItems / query.limit),
			},
		};
	}

	async getOne(id: string, actor: ChildActor) {
		const child = await this.findChild(id);
		await this.assertCanView(child, actor);
		return this.toResponse(child);
	}

	async create(dto: CreateChildDto, actor: ChildActor, ipAddress: string | null) {
		this.assertManager(actor);
		this.validateDateOfBirth(dto.dateOfBirth);
		return this.dataSource.transaction(async (manager) => {
			const classRepository = manager.getRepository(Classroom);
			const childRepository = manager.getRepository(Child);
			const classroom = await classRepository.findOne({
				where: { id: dto.classId },
				lock: { mode: "pessimistic_write" },
			});
			if (!classroom || classroom.status !== "ACTIVE") throw this.classUnavailable();

			const child = await childRepository.save(childRepository.create({
				name: dto.name,
				dateOfBirth: dto.dateOfBirth,
				gender: dto.gender,
				address: dto.address?.trim() || null,
				avatarUrl: dto.avatarUrl ?? null,
				classId: classroom.id,
				status: "ACTIVE",
			}));
			await this.auditLogsService.record(manager, {
				actorUserId: actor.id,
				actorName: actor.fullName,
				action: "CREATE_CHILD",
				resourceType: "child",
				resourceId: child.id,
				oldValue: null,
				newValue: { classId: child.classId, status: child.status },
				ipAddress,
			});
			return this.toResponse(child, manager.getRepository(ChildParent), manager.getRepository(User), manager.getRepository(Classroom));
		});
	}

	async update(id: string, dto: UpdateChildDto, actor: ChildActor, ipAddress: string | null) {
		this.assertManager(actor);
		this.assertNonEmptyUpdate(dto);
		if (dto.dateOfBirth) this.validateDateOfBirth(dto.dateOfBirth);

		return this.dataSource.transaction(async (manager) => {
			const childRepository = manager.getRepository(Child);
			const child = await childRepository.findOne({
				where: { id },
				lock: { mode: "pessimistic_write" },
			});
			if (!child) throw this.childNotFound();

			const oldValue = {
				name: child.name,
				dateOfBirth: child.dateOfBirth,
				gender: child.gender,
				address: child.address,
				avatarUrl: child.avatarUrl,
				classId: child.classId,
				status: child.status,
			};
			if (dto.classId && dto.classId !== child.classId) {
				const classRepository = manager.getRepository(Classroom);
				const destination = await classRepository.findOne({
					where: { id: dto.classId },
					lock: { mode: "pessimistic_write" },
				});
				if (!destination || destination.status !== "ACTIVE") throw this.classUnavailable();
				child.classId = destination.id;
			}
			if (dto.status === "ACTIVE") {
				const classroom = await manager.getRepository(Classroom).findOne({
					where: { id: child.classId },
					lock: { mode: "pessimistic_write" },
				});
				if (!classroom || classroom.status !== "ACTIVE") throw this.classUnavailable();
			}
			if (dto.name !== undefined) child.name = dto.name;
			if (dto.dateOfBirth !== undefined) child.dateOfBirth = dto.dateOfBirth;
			if (dto.gender !== undefined) child.gender = dto.gender;
			if (dto.address !== undefined) child.address = dto.address?.trim() || null;
			if (dto.avatarUrl !== undefined) child.avatarUrl = dto.avatarUrl;
			if (dto.status !== undefined) child.status = dto.status;

			const saved = await childRepository.save(child);
			const newValue = {
				name: saved.name,
				dateOfBirth: saved.dateOfBirth,
				gender: saved.gender,
				address: saved.address,
				avatarUrl: saved.avatarUrl,
				classId: saved.classId,
				status: saved.status,
			};
			if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
				await this.auditLogsService.record(manager, {
					actorUserId: actor.id,
					actorName: actor.fullName,
					action: saved.status === "WITHDRAWN" && oldValue.status !== "WITHDRAWN" ? "WITHDRAW_CHILD" : "UPDATE_CHILD",
					resourceType: "child",
					resourceId: saved.id,
					oldValue,
					newValue,
					ipAddress,
				});
			}
			return this.toResponse(saved, manager.getRepository(ChildParent), manager.getRepository(User), manager.getRepository(Classroom));
		});
	}

	async linkParent(childId: string, dto: LinkParentDto, actor: ChildActor, ipAddress: string | null) {
		this.assertManager(actor);
		try {
			return await this.dataSource.transaction(async (manager) => {
				const child = await manager.getRepository(Child).findOneBy({ id: childId });
				if (!child) throw this.childNotFound();
				const parent = await manager.getRepository(User).findOneBy({ id: dto.parentUserId });
				if (!parent || parent.role !== "PARENT" || parent.status !== "ACTIVE") {
					throw new BadRequestException({ code: "INVALID_PARENT", message: "Chỉ được liên kết tài khoản phụ huynh đang hoạt động." });
				}
				const links = manager.getRepository(ChildParent);
				if (await links.exist({ where: { childId, parentUserId: parent.id } })) {
					throw new ConflictException({ code: "PARENT_ALREADY_LINKED", message: "Phụ huynh này đã được liên kết với trẻ." });
				}
				await links.save(links.create({ childId, parentUserId: parent.id, relationship: dto.relationship }));
				await this.auditLogsService.record(manager, {
					actorUserId: actor.id,
					actorName: actor.fullName,
					action: "LINK_PARENT",
					resourceType: "child",
					resourceId: childId,
					oldValue: null,
					newValue: { parentUserId: parent.id, relationship: dto.relationship },
					ipAddress,
				});
				return { childId, parentUserId: parent.id, relationship: dto.relationship };
			});
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new ConflictException({ code: "PARENT_ALREADY_LINKED", message: "Phụ huynh này đã được liên kết với trẻ." });
			}
			throw error;
		}
	}

	private async toResponse(
		child: Child,
		linksRepository = this.childParentsRepository,
		usersRepository?: Repository<User>,
		classesRepository?: Repository<Classroom>,
	) {
		const links = await linksRepository.findBy({ childId: child.id });
		const parents = links.length
			? await (usersRepository ?? this.dataSource.getRepository(User)).findBy(
				links.map(({ parentUserId }) => ({ id: parentUserId })),
			)
			: [];
		const classroom = await (classesRepository ?? this.dataSource.getRepository(Classroom)).findOneBy({ id: child.classId });
		const parentsById = new Map(parents.map((parent) => [parent.id, parent]));
		return {
			id: child.id,
			name: child.name,
			dateOfBirth: child.dateOfBirth,
			gender: child.gender,
			address: child.address,
			avatarUrl: child.avatarUrl,
			classId: child.classId,
			className: classroom?.name ?? null,
			status: child.status,
			parentUserIds: links.map(({ parentUserId }) => parentUserId),
			parents: links.map((link) => {
				const parent = parentsById.get(link.parentUserId);
				return {
					parentUserId: link.parentUserId,
					fullName: parent?.fullName ?? parent?.email ?? "",
					relationship: link.relationship,
				};
			}),
		};
	}

	private async findChild(id: string) {
		const child = await this.childrenRepository.findOneBy({ id });
		if (!child) throw this.childNotFound();
		return child;
	}

	private async assertCanView(child: Child, actor: ChildActor) {
		if (actor.role === "MANAGER") return;
		if (actor.role === "TEACHER" && await this.dataSource.getRepository(ClassTeacher).exist({ where: { classId: child.classId, teacherUserId: actor.id } })) return;
		if (actor.role === "PARENT" && await this.childParentsRepository.exist({ where: { childId: child.id, parentUserId: actor.id } })) return;
		throw this.accessDenied();
	}

	private assertManager(actor: ChildActor) {
		if (actor.role !== "MANAGER") {
			throw new ForbiddenException({ code: "MANAGER_ONLY", message: "Chỉ quản lý cơ sở được quản lý hồ sơ trẻ." });
		}
	}

	private assertNonEmptyUpdate(dto: UpdateChildDto) {
		if (Object.values(dto).every((value) => value === undefined)) {
			throw new BadRequestException({ code: "EMPTY_UPDATE", message: "Hãy cung cấp thông tin cần cập nhật." });
		}
	}

	private validateDateOfBirth(value: string) {
		const date = new Date(`${value}T00:00:00.000Z`);
		if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value || date > new Date()) {
			throw new BadRequestException({ code: "INVALID_DATE_OF_BIRTH", message: "Ngày sinh không hợp lệ hoặc ở trong tương lai." });
		}
	}

	private classUnavailable() {
		return new NotFoundException({ code: "CLASS_NOT_AVAILABLE", message: "Không tìm thấy lớp đang hoạt động." });
	}

	private childNotFound() {
		return new NotFoundException({ code: "CHILD_NOT_FOUND", message: "Không tìm thấy hồ sơ trẻ." });
	}

	private accessDenied() {
		return new ForbiddenException({ code: "CHILD_ACCESS_DENIED", message: "Bạn không được truy cập hồ sơ trẻ này." });
	}
}
