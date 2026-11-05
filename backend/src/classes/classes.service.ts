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
import { User } from "../users/user.entity";
import { Child } from "../children/child.entity";
import { ClassTeacher } from "./class-teacher.entity";
import { Classroom } from "./class.entity";
import { AssignTeachersDto } from "./dto/assign-teachers.dto";
import { CreateClassDto } from "./dto/create-class.dto";
import { ListClassesQueryDto } from "./dto/list-classes-query.dto";
import { UpdateClassDto } from "./dto/update-class.dto";

type ClassActor = Pick<User, "id" | "email" | "fullName" | "role">;

function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "23505"
	);
}

@Injectable()
export class ClassesService {
	constructor(
		@InjectRepository(Classroom)
		private readonly classesRepository: Repository<Classroom>,
		@InjectRepository(ClassTeacher)
		private readonly classTeachersRepository: Repository<ClassTeacher>,
		@InjectRepository(Child)
		private readonly childrenRepository: Repository<Child>,
		private readonly dataSource: DataSource,
		private readonly auditLogsService: AuditLogsService,
	) {}

	async list(query: ListClassesQueryDto, actor: ClassActor) {
		if (actor.role !== "MANAGER" && actor.role !== "TEACHER") {
			throw new ForbiddenException({
				code: "CLASS_ACCESS_DENIED",
				message: "Chỉ quản lý và giáo viên được xem danh sách lớp.",
			});
		}

		const qb = this.classesRepository.createQueryBuilder("class");
		if (query.academicYear) {
			qb.andWhere("class.academicYear = :academicYear", {
				academicYear: query.academicYear.trim(),
			});
		}
		if (query.status) qb.andWhere("class.status = :status", { status: query.status });
		if (actor.role === "TEACHER") {
			qb.innerJoin(
				ClassTeacher,
				"assignment",
				"assignment.classId = class.id AND assignment.teacherUserId = :teacherId",
				{ teacherId: actor.id },
			);
		}
		qb.orderBy("class.academicYear", "DESC")
			.addOrderBy("class.name", "ASC")
			.skip((query.page - 1) * query.limit)
			.take(query.limit);

		const [classes, totalItems] = await qb.getManyAndCount();
		const items = await Promise.all(classes.map((classroom) => this.toResponse(classroom)));

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

	async getOne(id: string, actor: ClassActor) {
		const classroom = await this.findClass(id);
		await this.assertCanView(classroom.id, actor);
		return this.toResponse(classroom);
	}

	async create(dto: CreateClassDto, actor: ClassActor, ipAddress: string | null) {
		this.assertManager(actor);
		try {
			return await this.dataSource.transaction(async (manager) => {
				const repository = manager.getRepository(Classroom);
				const classroom = await repository.save(
					repository.create({
						name: dto.name,
						academicYear: dto.academicYear,
						status: "ACTIVE",
					}),
				);
				await this.auditLogsService.record(manager, {
					actorUserId: actor.id,
					actorName: actor.fullName,
					action: "CREATE_CLASS",
					resourceType: "class",
					resourceId: classroom.id,
					oldValue: null,
					newValue: { name: classroom.name, academicYear: classroom.academicYear, status: classroom.status },
					ipAddress,
				});
				return this.toResponse(classroom, manager.getRepository(ClassTeacher), manager.getRepository(User));
			});
		} catch (error) {
			if (isUniqueViolation(error)) throw this.duplicateClassError();
			throw error;
		}
	}

	async update(id: string, dto: UpdateClassDto, actor: ClassActor, ipAddress: string | null) {
		this.assertManager(actor);
		if (!dto.name && !dto.academicYear && !dto.status) {
			throw new BadRequestException({ code: "EMPTY_UPDATE", message: "Hãy cung cấp thông tin cần cập nhật." });
		}
		try {
			return await this.dataSource.transaction(async (manager) => {
				const repository = manager.getRepository(Classroom);
				const classroom = await repository.findOne({
					where: { id },
					lock: { mode: "pessimistic_write" },
				});
				if (!classroom) throw this.classNotFound();
				const oldValue = { name: classroom.name, academicYear: classroom.academicYear, status: classroom.status };
				if (dto.name !== undefined) classroom.name = dto.name;
				if (dto.academicYear !== undefined) classroom.academicYear = dto.academicYear;
				if (dto.status === "CLOSED" && classroom.status !== "CLOSED") {
					const activeChildren = await manager.getRepository(Child).countBy({
						classId: classroom.id,
						status: "ACTIVE",
					});
					if (activeChildren > 0) {
						throw new ConflictException({
							code: "CLASS_HAS_ACTIVE_CHILDREN",
							message: "Chuyển trẻ đang học sang lớp khác trước khi đóng lớp.",
						});
					}
				}
				if (dto.status !== undefined) classroom.status = dto.status;
				const saved = await repository.save(classroom);
				const newValue = { name: saved.name, academicYear: saved.academicYear, status: saved.status };
				if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
					await this.auditLogsService.record(manager, {
						actorUserId: actor.id,
						actorName: actor.fullName,
						action: saved.status === "CLOSED" && oldValue.status !== "CLOSED" ? "CLOSE_CLASS" : "UPDATE_CLASS",
						resourceType: "class",
						resourceId: saved.id,
						oldValue,
						newValue,
						ipAddress,
					});
				}
				return this.toResponse(saved, manager.getRepository(ClassTeacher), manager.getRepository(User));
			});
		} catch (error) {
			if (isUniqueViolation(error)) throw this.duplicateClassError();
			throw error;
		}
	}

	async assignTeachers(
		id: string,
		dto: AssignTeachersDto,
		actor: ClassActor,
		ipAddress: string | null,
	) {
		this.assertManager(actor);
		return this.dataSource.transaction(async (manager) => {
			const classRepository = manager.getRepository(Classroom);
			const classTeacherRepository = manager.getRepository(ClassTeacher);
			const userRepository = manager.getRepository(User);
			const classroom = await classRepository.findOneBy({ id });
			if (!classroom) throw this.classNotFound();
			if (classroom.status === "CLOSED") {
				throw new ConflictException({ code: "CLASS_CLOSED", message: "Không thể phân công giáo viên vào lớp đã đóng." });
			}

			const users = await userRepository.findBy(dto.teacherUserIds.map((teacherId) => ({ id: teacherId })));
			if (users.length !== dto.teacherUserIds.length || users.some((user) => user.role !== "TEACHER" || user.status !== "ACTIVE")) {
				throw new BadRequestException({ code: "INVALID_TEACHER", message: "Chỉ được phân công tài khoản giáo viên đang hoạt động." });
			}

			const existing = await classTeacherRepository.findBy({ classId: id });
			const existingIds = new Set(existing.map((assignment) => assignment.teacherUserId));
			const newIds = dto.teacherUserIds.filter((teacherId) => !existingIds.has(teacherId));
			if (newIds.length !== dto.teacherUserIds.length) {
				throw new ConflictException({ code: "ASSIGNMENT_EXISTS", message: "Một hoặc nhiều giáo viên đã được phân công vào lớp." });
			}

			await classTeacherRepository.save(newIds.map((teacherUserId) => classTeacherRepository.create({ classId: id, teacherUserId })));
			await this.auditLogsService.record(manager, {
				actorUserId: actor.id,
				actorName: actor.fullName,
				action: "ASSIGN_TEACHER",
				resourceType: "class",
				resourceId: id,
				oldValue: { teacherUserIds: existing.map((assignment) => assignment.teacherUserId) },
				newValue: { teacherUserIds: [...existingIds, ...newIds] },
				ipAddress,
			});
			return newIds.map((teacherUserId) => ({ classId: id, teacherUserId }));
		});
	}

	async removeTeacher(id: string, teacherUserId: string, actor: ClassActor, ipAddress: string | null) {
		this.assertManager(actor);
		return this.dataSource.transaction(async (manager) => {
			const classRepository = manager.getRepository(Classroom);
			const assignmentRepository = manager.getRepository(ClassTeacher);
			const classroom = await classRepository.findOneBy({ id });
			if (!classroom) throw this.classNotFound();
			const assignment = await assignmentRepository.findOneBy({ classId: id, teacherUserId });
			if (!assignment) throw new NotFoundException({ code: "ASSIGNMENT_NOT_FOUND", message: "Không tìm thấy phân công giáo viên." });
			await assignmentRepository.remove(assignment);
			await this.auditLogsService.record(manager, {
				actorUserId: actor.id,
				actorName: actor.fullName,
				action: "REMOVE_TEACHER",
				resourceType: "class",
				resourceId: id,
				oldValue: { teacherUserId },
				newValue: null,
				ipAddress,
			});
		});
	}

	private async toResponse(
		classroom: Classroom,
		assignmentRepository = this.classTeachersRepository,
		userRepository?: Repository<User>,
	) {
		const assignments = await assignmentRepository.findBy({ classId: classroom.id });
		const childCount = await this.childrenRepository.countBy({
			classId: classroom.id,
			status: "ACTIVE",
		});
		const teachers = assignments.length
			? await (userRepository ?? this.dataSource.getRepository(User)).findBy(
				assignments.map(({ teacherUserId }) => ({ id: teacherUserId })),
			)
			: [];
		return {
			id: classroom.id,
			name: classroom.name,
			academicYear: classroom.academicYear,
			status: classroom.status,
			teacherUserIds: assignments.map(({ teacherUserId }) => teacherUserId),
			teachers: teachers.map(({ id, fullName, email }) => ({ id, fullName: fullName ?? "", email })),
			childCount,
		};
	}

	private async findClass(id: string) {
		const classroom = await this.classesRepository.findOneBy({ id });
		if (!classroom) throw this.classNotFound();
		return classroom;
	}

	private async assertCanView(classId: string, actor: ClassActor) {
		if (actor.role === "MANAGER") return;
		if (actor.role === "TEACHER" && await this.classTeachersRepository.exist({ where: { classId, teacherUserId: actor.id } })) return;
		throw new ForbiddenException({ code: "CLASS_ACCESS_DENIED", message: "Bạn không được truy cập lớp này." });
	}

	private assertManager(actor: ClassActor) {
		if (actor.role !== "MANAGER") {
			throw new ForbiddenException({ code: "MANAGER_ONLY", message: "Chỉ quản lý cơ sở được quản lý lớp." });
		}
	}

	private classNotFound() {
		return new NotFoundException({ code: "CLASS_NOT_FOUND", message: "Không tìm thấy lớp." });
	}

	private duplicateClassError() {
		return new ConflictException({ code: "CLASS_ALREADY_EXISTS", message: "Tên lớp đã được dùng trong năm học này." });
	}
}
