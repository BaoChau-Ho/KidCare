import {
	ConflictException,
	ForbiddenException,
	Injectable,
    BadRequestException,
    NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { User } from "./user.entity";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import * as argon2 from "argon2";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { ChangeUserRoleDto } from "./dto/change-user-role.dto";
import { ChangeUserStatusDto } from "./dto/change-user-status.dto";
import { AuditLogsService } from "../audit-logs/audit-logs.service";

function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "23505"
	);
}

type UserActor = Pick<User, "id" | "role">;
type AuditActor = Pick<User, "id" | "fullName">;

@Injectable()
export class UsersService {
	constructor(
		@InjectRepository(User)
		private readonly usersRepository: Repository<User>,
		private readonly dataSource: DataSource,
		private readonly auditLogsService: AuditLogsService,
	) {}

	async list(query: ListUsersQueryDto, actor: UserActor) {
		const page = query.page;
		const limit = query.limit;

		const qb = this.usersRepository
			.createQueryBuilder("user")
			// Chỉ chọn trường được phép trả về, không lấy passwordHash hoặc nationalId.
			.select([
				"user.id",
				"user.email",
				"user.fullName",
				"user.phone",
				"user.role",
				"user.status",
				"user.createdAt",
			]);

		if (actor.role === "MANAGER") {
			if (query.role !== "TEACHER" && query.role !== "PARENT") {
				throw new ForbiddenException({
					code: "MANAGER_LOOKUP_REQUIRES_ROLE",
					message: "Manager chỉ được tra cứu TEACHER hoặc PARENT.",
				});
			}

			qb.andWhere("user.status = :activeStatus", {
				activeStatus: "ACTIVE",
			});
			qb.andWhere("user.role = :role", { role: query.role });
		} else if (actor.role !== "ADMIN") {
			throw new ForbiddenException({
				code: "USERS_ACCESS_DENIED",
				message: "Bạn không có quyền xem danh sách tài khoản.",
			});
		}

		if (query.role && actor.role === "ADMIN") {
			qb.andWhere("user.role = :role", { role: query.role });
		}

		if (query.status && actor.role === "ADMIN") {
			qb.andWhere("user.status = :status", { status: query.status });
		}

		if (query.query) {
			const search = `%${query.query.toLowerCase()}%`;

			qb.andWhere(
				`(LOWER(COALESCE(user.fullName, '')) LIKE :search
          OR LOWER(user.email) LIKE :search)`,
				{ search },
			);
		}

		qb.orderBy("user.createdAt", "DESC")
			.addOrderBy("user.id", "ASC")
			.skip((page - 1) * limit)
			.take(limit);

		const [items, totalItems] = await qb.getManyAndCount();

		return {
			items,
			pageInfo: {
				page,
				limit,
				totalItems,
				totalPages: Math.ceil(totalItems / limit),
			},
		};
	}
	async create(
		dto: CreateUserDto,
		actor: AuditActor,
		ipAddress: string | null,
	) {
		const email = dto.email.trim().toLowerCase();
		const passwordHash = await argon2.hash(dto.temporaryPassword);

		try {
			return await this.dataSource.transaction(async (manager) => {
				const userRepository = manager.getRepository(User);
				const existingUser = await userRepository.findOneBy({ email });

				if (existingUser) {
					throw new ConflictException({
						code: "EMAIL_EXISTS",
						message: "Email đã được sử dụng.",
					});
				}

				const user = userRepository.create({
					email,
					passwordHash,
					fullName: dto.fullName.trim(),
					role: dto.role,
					status: "ACTIVE",
					phone: dto.phone?.trim() || null,
					nationalId: null,
				});

				const saved = await userRepository.save(user);

				await this.auditLogsService.record(manager, {
					actorUserId: actor.id,
					actorName: actor.fullName,
					action: "CREATE_USER",
					resourceType: "user",
					resourceId: saved.id,
					oldValue: null,
					newValue: { role: saved.role, status: saved.status },
					ipAddress,
				});

				return {
					id: saved.id,
					email: saved.email,
					fullName: saved.fullName,
					phone: saved.phone,
					role: saved.role,
					status: saved.status,
					createdAt: saved.createdAt,
				};
			});
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new ConflictException({
					code: "EMAIL_EXISTS",
					message: "Email đã được sử dụng.",
				});
			}
			throw error;
		}

	}
	async update(
		id: string,
		dto: UpdateUserDto,
		actor: AuditActor,
		ipAddress: string | null,
	) {
		if (dto.fullName === undefined && dto.phone === undefined) {
			throw new BadRequestException({
				code: "EMPTY_UPDATE",
				message: "Hãy cung cấp ít nhất một trường cần cập nhật.",
			});
		}

		return this.dataSource.transaction(async (manager) => {
			const userRepository = manager.getRepository(User);
			const user = await userRepository.findOneBy({ id });

			if (!user) {
				throw new NotFoundException({
					code: "USER_NOT_FOUND",
					message: "Không tìm thấy tài khoản.",
				});
			}

			const oldValue: Record<string, unknown> = {};
			const newValue: Record<string, unknown> = {};

			if (dto.fullName !== undefined) {
				oldValue.fullName = user.fullName;
				user.fullName = dto.fullName.trim();
				newValue.fullName = user.fullName;
			}

			if (dto.phone !== undefined) {
				oldValue.phone = user.phone;
				user.phone = dto.phone?.trim() || null;
				newValue.phone = user.phone;
			}

			const saved = await userRepository.save(user);

			await this.auditLogsService.record(manager, {
				actorUserId: actor.id,
				actorName: actor.fullName,
				action: "UPDATE_USER",
				resourceType: "user",
				resourceId: saved.id,
				oldValue,
				newValue,
				ipAddress,
			});

			return {
				id: saved.id,
				email: saved.email,
				fullName: saved.fullName,
				phone: saved.phone,
				role: saved.role,
				status: saved.status,
				createdAt: saved.createdAt,
			};
		});
	}
	async changeRole(
		id: string,
		dto: ChangeUserRoleDto,
		actor: AuditActor,
		ipAddress: string | null,
	) {
		return this.dataSource.transaction(async (manager) => {
			const userRepository = manager.getRepository(User);
			const user = await userRepository.findOneBy({ id });

			if (!user) {
				throw new NotFoundException({
					code: "USER_NOT_FOUND",
					message: "Không tìm thấy tài khoản.",
				});
			}

			const oldRole = user.role;
			user.role = dto.role;
			const saved = await userRepository.save(user);

			await this.auditLogsService.record(manager, {
				actorUserId: actor.id,
				actorName: actor.fullName,
				action: "CHANGE_USER_ROLE",
				resourceType: "user",
				resourceId: saved.id,
				oldValue: { role: oldRole },
				newValue: { role: saved.role },
				ipAddress,
			});

			return {
				id: saved.id,
				email: saved.email,
				fullName: saved.fullName,
				phone: saved.phone,
				role: saved.role,
				status: saved.status,
				createdAt: saved.createdAt,
			};
		});
	}
	async changeStatus(
		id: string,
		dto: ChangeUserStatusDto,
		actor: AuditActor,
		ipAddress: string | null,
	) {
		return this.dataSource.transaction(async (manager) => {
			const userRepository = manager.getRepository(User);
			const user = await userRepository.findOneBy({ id });

			if (!user) {
				throw new NotFoundException({
					code: "USER_NOT_FOUND",
					message: "Không tìm thấy tài khoản.",
				});
			}

			if (id === actor.id && dto.status !== "ACTIVE") {
				throw new ForbiddenException({
					code: "SELF_STATUS_CHANGE",
					message: "Bạn không thể tự khóa hoặc vô hiệu hóa tài khoản của mình.",
				});
			}

			const oldStatus = user.status;
			user.status = dto.status;
			const saved = await userRepository.save(user);

			await this.auditLogsService.record(manager, {
				actorUserId: actor.id,
				actorName: actor.fullName,
				action: "CHANGE_USER_STATUS",
				resourceType: "user",
				resourceId: saved.id,
				oldValue: { status: oldStatus },
				newValue: { status: saved.status },
				ipAddress,
			});

			return {
				id: saved.id,
				email: saved.email,
				fullName: saved.fullName,
				phone: saved.phone,
				role: saved.role,
				status: saved.status,
				createdAt: saved.createdAt,
			};
		});
	}
}
