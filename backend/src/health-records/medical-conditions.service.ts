import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import { ChildAccessService } from "../access/child-access.service";
import type { AccessActor } from "../access/child-access.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { Child } from "../children/child.entity";
import { CreateMedicalConditionDto } from "./dto/create-medical-condition.dto";
import { UpdateMedicalConditionDto } from "./dto/update-medical-condition.dto";
import { MedicalCondition } from "./medical-condition.entity";
import { DomainEventPublisher } from "../common/domain-events/domain-event.publisher";

@Injectable()
export class MedicalConditionsService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly access: ChildAccessService,
		private readonly auditLogsService: AuditLogsService,
		private readonly events: DomainEventPublisher,
	) {}

	async create(
		childId: string,
		dto: CreateMedicalConditionDto,
		actor: AccessActor,
		ipAddress: string | null,
	) {
		this.assertMedicalStaff(actor);
		const name = dto.name.trim();

		const condition = await this.dataSource.transaction(async (manager) => {
			// Khóa trẻ để hai request đồng thời không tạo trùng bệnh nền active.
			const child = await manager.getRepository(Child).findOne({
				where: { id: childId },
				lock: { mode: "pessimistic_write" },
			});
			if (!child) throw this.childNotFound();

			const repository = manager.getRepository(MedicalCondition);
			if (await this.hasActiveDuplicate(repository, child.id, name)) {
				throw this.duplicateError();
			}

			const saved = await repository.save(
				repository.create({
					childId: child.id,
					name,
					note: dto.note?.trim() || null,
					active: true,
				}),
			);
			await this.auditLogsService.record(manager, {
				actorUserId: actor.id,
				actorName: actor.fullName,
				action: "CREATE_MEDICAL_CONDITION",
				resourceType: "medical_condition",
				resourceId: saved.id,
				oldValue: null,
				// Tránh đưa tên bệnh và ghi chú y tế tự do vào audit log.
				newValue: {
					childId: child.id,
					active: saved.active,
					notePresent: saved.note !== null,
				},
				ipAddress,
			});
			return saved;
		});
		this.events.publish("health-record.changed", {
			childId: condition.childId,
			resourceType: "medical_condition",
			resourceId: condition.id,
		});

		return this.toResponse(condition);
	}

	async list(childId: string, actor: AccessActor) {
		this.assertMedicalStaff(actor);
		const childExists = await this.dataSource.getRepository(Child).exist({
			where: { id: childId },
		});
		if (!childExists) throw this.childNotFound();

		const items = await this.dataSource.getRepository(MedicalCondition).find({
			where: { childId },
			order: { createdAt: "DESC", id: "DESC" },
		});
		return { items: items.map((condition) => this.toResponse(condition)) };
	}

	async update(
		conditionId: string,
		dto: UpdateMedicalConditionDto,
		actor: AccessActor,
		ipAddress: string | null,
	) {
		this.assertMedicalStaff(actor);
		if (dto.note === undefined && dto.active === undefined) {
			throw new BadRequestException({
				code: "EMPTY_UPDATE",
				message: "Hãy cung cấp thông tin cần cập nhật.",
			});
		}

		const condition = await this.dataSource.transaction(async (manager) => {
			const repository = manager.getRepository(MedicalCondition);
			const condition = await repository.findOne({
				where: { id: conditionId },
				lock: { mode: "pessimistic_write" },
			});
			if (!condition) throw this.conditionNotFound();

			if (dto.active === true) {
				const child = await manager.getRepository(Child).findOne({
					where: { id: condition.childId },
					lock: { mode: "pessimistic_write" },
				});
				if (!child) throw this.childNotFound();
				if (
					await this.hasActiveDuplicate(
						repository,
						condition.childId,
						condition.name,
						condition.id,
					)
				) {
					throw this.duplicateError();
				}
			}

			const before = {
				active: condition.active,
				notePresent: condition.note !== null,
			};
			if (dto.note !== undefined) {
				condition.note = dto.note === null ? null : dto.note.trim() || null;
			}
			if (dto.active !== undefined) condition.active = dto.active;

			const saved = await repository.save(condition);
			const after = {
				active: saved.active,
				notePresent: saved.note !== null,
			};
			if (JSON.stringify(before) !== JSON.stringify(after)) {
				// Chỉ ghi nhận note có/không; không lưu nội dung ghi chú vào audit log.
				await this.auditLogsService.record(manager, {
					actorUserId: actor.id,
					actorName: actor.fullName,
					action: "UPDATE_MEDICAL_CONDITION",
					resourceType: "medical_condition",
					resourceId: saved.id,
					oldValue: before,
					newValue: after,
					ipAddress,
				});
			}
			return saved;
		});
		this.events.publish("health-record.changed", {
			childId: condition.childId,
			resourceType: "medical_condition",
			resourceId: condition.id,
		});

		return this.toResponse(condition);
	}

	private async hasActiveDuplicate(
		repository: Repository<MedicalCondition>,
		childId: string,
		name: string,
		exceptId?: string,
	): Promise<boolean> {
		const query = repository
			.createQueryBuilder("condition")
			.where("condition.childId = :childId", { childId })
			.andWhere("LOWER(condition.name) = LOWER(:name)", { name })
			.andWhere("condition.active = true");
		if (exceptId) query.andWhere("condition.id <> :exceptId", { exceptId });
		return query.getExists();
	}

	private assertMedicalStaff(actor: AccessActor) {
		this.access.assertRole(
			actor,
			["MEDICAL_STAFF"],
			"Chỉ nhân viên y tế được quản lý bệnh nền.",
		);
	}

	private toResponse(condition: MedicalCondition) {
		return {
			id: condition.id,
			childId: condition.childId,
			name: condition.name,
			note: condition.note,
			active: condition.active,
			createdAt: condition.createdAt.toISOString(),
		};
	}

	private childNotFound() {
		return new NotFoundException({
			code: "CHILD_NOT_FOUND",
			message: "Không tìm thấy hồ sơ trẻ.",
		});
	}

	private conditionNotFound() {
		return new NotFoundException({
			code: "MEDICAL_CONDITION_NOT_FOUND",
			message: "Không tìm thấy thông tin bệnh nền.",
		});
	}

	private duplicateError() {
		return new ConflictException({
			code: "MEDICAL_CONDITION_ALREADY_EXISTS",
			message: "Trẻ đã có bệnh nền đang được theo dõi với tên này.",
		});
	}
}
