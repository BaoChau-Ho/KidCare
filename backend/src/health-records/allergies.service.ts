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
import { Allergy } from "./allergy.entity";
import { CreateAllergyDto } from "./dto/create-allergy.dto";
import { UpdateAllergyDto } from "./dto/update-allergy.dto";
import { DomainEventPublisher } from "../common/domain-events/domain-event.publisher";

@Injectable()
export class AllergiesService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly access: ChildAccessService,
		private readonly auditLogsService: AuditLogsService,
		private readonly events: DomainEventPublisher,
	) {}

	async create(
		childId: string,
		dto: CreateAllergyDto,
		actor: AccessActor,
		ipAddress: string | null,
	) {
		this.assertMedicalStaff(actor);
		const allergen = dto.allergen.trim();

		const allergy = await this.dataSource.transaction(async (manager) => {
			// Khóa trẻ để hai request đồng thời không cùng tạo một dị ứng active bị trùng.
			const child = await manager.getRepository(Child).findOne({
				where: { id: childId },
				lock: { mode: "pessimistic_write" },
			});
			if (!child) throw this.childNotFound();

			const repository = manager.getRepository(Allergy);
			if (await this.hasActiveDuplicate(repository, child.id, allergen)) {
				throw this.duplicateError();
			}

			const saved = await repository.save(
				repository.create({
					childId: child.id,
					allergen,
					severity: dto.severity,
					note: dto.note?.trim() || null,
					active: true,
				}),
			);
			await this.auditLogsService.record(manager, {
				actorUserId: actor.id,
				actorName: actor.fullName,
				action: "CREATE_ALLERGY",
				resourceType: "allergy",
				resourceId: saved.id,
				oldValue: null,
				// Không ghi allergen/note tự do vào audit log.
				newValue: { childId: child.id, severity: saved.severity, active: saved.active },
				ipAddress,
			});
			return saved;
		});
		this.events.publish("health-record.changed", {
			childId: allergy.childId,
			resourceType: "allergy",
			resourceId: allergy.id,
		});

		return this.toResponse(allergy);
	}

	async list(childId: string, actor: AccessActor) {
		this.assertMedicalStaff(actor);
		const childExists = await this.dataSource.getRepository(Child).exist({
			where: { id: childId },
		});
		if (!childExists) throw this.childNotFound();

		const items = await this.dataSource.getRepository(Allergy).find({
			where: { childId },
			order: { createdAt: "DESC", id: "DESC" },
		});
		return { items: items.map((allergy) => this.toResponse(allergy)) };
	}

	async update(
		allergyId: string,
		dto: UpdateAllergyDto,
		actor: AccessActor,
		ipAddress: string | null,
	) {
		this.assertMedicalStaff(actor);
		if (
			dto.severity === undefined &&
			dto.note === undefined &&
			dto.active === undefined
		) {
			throw new BadRequestException({
				code: "EMPTY_UPDATE",
				message: "Hãy cung cấp thông tin cần cập nhật.",
			});
		}

		const allergy = await this.dataSource.transaction(async (manager) => {
			const repository = manager.getRepository(Allergy);
			const allergy = await repository.findOne({
				where: { id: allergyId },
				lock: { mode: "pessimistic_write" },
			});
			if (!allergy) throw this.allergyNotFound();

			if (dto.active === true) {
				const child = await manager.getRepository(Child).findOne({
					where: { id: allergy.childId },
					lock: { mode: "pessimistic_write" },
				});
				if (!child) throw this.childNotFound();
				if (
					await this.hasActiveDuplicate(
						repository,
						allergy.childId,
						allergy.allergen,
						allergy.id,
					)
				) {
					throw this.duplicateError();
				}
			}

			const before = {
				severity: allergy.severity,
				active: allergy.active,
				notePresent: allergy.note !== null,
			};
			if (dto.severity !== undefined) allergy.severity = dto.severity;
			if (dto.note !== undefined) {
				allergy.note = dto.note === null ? null : dto.note.trim() || null;
			}
			if (dto.active !== undefined) allergy.active = dto.active;

			const saved = await repository.save(allergy);
			const after = {
				severity: saved.severity,
				active: saved.active,
				notePresent: saved.note !== null,
			};
			if (JSON.stringify(before) !== JSON.stringify(after)) {
				// Chỉ ghi nhận note có/không; không lưu nội dung dị ứng tự do vào audit log.
				await this.auditLogsService.record(manager, {
					actorUserId: actor.id,
					actorName: actor.fullName,
					action: "UPDATE_ALLERGY",
					resourceType: "allergy",
					resourceId: saved.id,
					oldValue: before,
					newValue: after,
					ipAddress,
				});
			}
			return saved;
		});
		this.events.publish("health-record.changed", {
			childId: allergy.childId,
			resourceType: "allergy",
			resourceId: allergy.id,
		});

		return this.toResponse(allergy);
	}

	private async hasActiveDuplicate(
		repository: Repository<Allergy>,
		childId: string,
		allergen: string,
		exceptId?: string,
	): Promise<boolean> {
		const query = repository
			.createQueryBuilder("allergy")
			.where("allergy.childId = :childId", { childId })
			.andWhere("LOWER(allergy.allergen) = LOWER(:allergen)", { allergen })
			.andWhere("allergy.active = true");
		if (exceptId) query.andWhere("allergy.id <> :exceptId", { exceptId });
		return query.getExists();
	}

	private assertMedicalStaff(actor: AccessActor) {
		this.access.assertRole(
			actor,
			["MEDICAL_STAFF"],
			"Chỉ nhân viên y tế được quản lý dị ứng.",
		);
	}

	private toResponse(allergy: Allergy) {
		return {
			id: allergy.id,
			childId: allergy.childId,
			allergen: allergy.allergen,
			severity: allergy.severity,
			note: allergy.note,
			active: allergy.active,
			createdAt: allergy.createdAt.toISOString(),
		};
	}

	private childNotFound() {
		return new NotFoundException({
			code: "CHILD_NOT_FOUND",
			message: "Không tìm thấy hồ sơ trẻ.",
		});
	}

	private allergyNotFound() {
		return new NotFoundException({
			code: "ALLERGY_NOT_FOUND",
			message: "Không tìm thấy thông tin dị ứng.",
		});
	}

	private duplicateError() {
		return new ConflictException({
			code: "ALLERGY_ALREADY_EXISTS",
			message: "Trẻ đã có dị ứng đang được theo dõi với tác nhân này.",
		});
	}
}
