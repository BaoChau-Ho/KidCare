import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { ChildAccessService } from "../access/child-access.service";
import type { AccessActor } from "../access/child-access.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { Child } from "../children/child.entity";
import { CreateHealthRecordDto } from "./dto/create-health-record.dto";
import { ListHealthRecordsQueryDto } from "./dto/list-health-records-query.dto";
import { HealthRecord } from "./health-record.entity";
import { UpdateHealthRecordDto } from "./dto/update-health-record.dto";
import { User } from "../users/user.entity";
import { DomainEventPublisher } from "../common/domain-events/domain-event.publisher";

@Injectable()
export class HealthRecordsService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly access: ChildAccessService,
		private readonly auditLogsService: AuditLogsService,
		private readonly events: DomainEventPublisher,
	) {}

	async create(
		childId: string,
		dto: CreateHealthRecordDto,
		actor: AccessActor,
		ipAddress: string | null,
	) {
		this.access.assertRole(
			actor,
			["MEDICAL_STAFF"],
			"Chỉ nhân viên y tế được ghi số đo sức khỏe.",
		);

		if (
			dto.height === undefined &&
			dto.weight === undefined &&
			dto.temperature === undefined
		) {
			throw new BadRequestException({
				code: "HEALTH_MEASUREMENT_REQUIRED",
				message: "Cần cung cấp ít nhất một chỉ số sức khỏe.",
			});
		}

		const record = await this.dataSource.transaction(async (manager) => {
			const child = await manager.getRepository(Child).findOneBy({ id: childId });
			if (!child) {
				throw new NotFoundException({
					code: "CHILD_NOT_FOUND",
					message: "Không tìm thấy hồ sơ trẻ.",
				});
			}

			const repository = manager.getRepository(HealthRecord);
			const saved = await repository.save(
				repository.create({
					childId: child.id,
					recordedByStaffUserId: actor.id,
					height: dto.height ?? null,
					weight: dto.weight ?? null,
					temperature: dto.temperature ?? null,
					note: dto.note?.trim() || null,
				}),
			);

			// Không đưa ghi chú sức khỏe vào audit log; chỉ ghi các chỉ số cần kiểm tra thay đổi.
			await this.auditLogsService.record(manager, {
				actorUserId: actor.id,
				actorName: actor.fullName,
				action: "CREATE_HEALTH_RECORD",
				resourceType: "health_record",
				resourceId: saved.id,
				oldValue: null,
				newValue: {
					childId: child.id,
					height: saved.height,
					weight: saved.weight,
					temperature: saved.temperature,
				},
				ipAddress,
			});

			return saved;
		});
		this.events.publish("health-record.changed", {
			childId: record.childId,
			resourceType: "health_record",
			resourceId: record.id,
		});

		return this.toResponse(record, actor.fullName);
	}

	async list(
		childId: string,
		query: ListHealthRecordsQueryDto,
		actor: AccessActor,
	) {
		this.access.assertRole(
			actor,
			["MEDICAL_STAFF"],
			"Chỉ nhân viên y tế được xem lịch sử số đo chi tiết.",
		);

		const childExists = await this.dataSource.getRepository(Child).exist({
			where: { id: childId },
		});
		if (!childExists) {
			throw new NotFoundException({
				code: "CHILD_NOT_FOUND",
				message: "Không tìm thấy hồ sơ trẻ.",
			});
		}

		const [records, totalItems] = await this.dataSource
			.getRepository(HealthRecord)
			.findAndCount({
				select: {
					id: true,
					childId: true,
					recordedByStaffUserId: true,
					height: true,
					weight: true,
					temperature: true,
					note: true,
					recordedAt: true,
					recordedByStaff: { id: true, fullName: true },
				},
				where: { childId },
				relations: { recordedByStaff: true },
				order: { recordedAt: "DESC", id: "DESC" },
				skip: (query.page - 1) * query.limit,
				take: query.limit,
			});

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

	async update(
		recordId: string,
		dto: UpdateHealthRecordDto,
		actor: AccessActor,
		ipAddress: string | null,
	) {
		this.access.assertRole(
			actor,
			["MEDICAL_STAFF"],
			"Chỉ nhân viên y tế được sửa số đo sức khỏe.",
		);

		if (
			dto.height === undefined &&
			dto.weight === undefined &&
			dto.temperature === undefined &&
			dto.note === undefined
		) {
			throw new BadRequestException({
				code: "EMPTY_UPDATE",
				message: "Hãy cung cấp thông tin cần cập nhật.",
			});
		}

		const { record, recordedByName } = await this.dataSource.transaction(async (manager) => {
			const repository = manager.getRepository(HealthRecord);
			const record = await repository.findOne({
				where: { id: recordId },
				lock: { mode: "pessimistic_write" },
			});
			if (!record) {
				throw new NotFoundException({
					code: "HEALTH_RECORD_NOT_FOUND",
					message: "Không tìm thấy bản ghi sức khỏe.",
				});
			}

			const before = {
				height: record.height,
				weight: record.weight,
				temperature: record.temperature,
				notePresent: record.note !== null,
			};

			if (dto.height !== undefined) record.height = dto.height;
			if (dto.weight !== undefined) record.weight = dto.weight;
			if (dto.temperature !== undefined) record.temperature = dto.temperature;
			if (dto.note !== undefined) {
				record.note = dto.note === null ? null : dto.note.trim() || null;
			}

			if (record.height === null && record.weight === null && record.temperature === null) {
				throw new BadRequestException({
					code: "HEALTH_MEASUREMENT_REQUIRED",
					message: "Bản ghi phải còn ít nhất một chỉ số sức khỏe.",
				});
			}

			const saved = await repository.save(record);
			const after = {
				height: saved.height,
				weight: saved.weight,
				temperature: saved.temperature,
				notePresent: saved.note !== null,
			};
			if (JSON.stringify(before) !== JSON.stringify(after)) {
				// Ghi nhận cả việc note đổi nhưng không lưu nội dung ghi chú vào audit log.
				await this.auditLogsService.record(manager, {
					actorUserId: actor.id,
					actorName: actor.fullName,
					action: "UPDATE_HEALTH_RECORD",
					resourceType: "health_record",
					resourceId: saved.id,
					oldValue: before,
					newValue: after,
					ipAddress,
				});
			}

			const recorder = await manager.getRepository(User).findOne({
				where: { id: saved.recordedByStaffUserId },
				select: { id: true, fullName: true },
			});
			return { record: saved, recordedByName: recorder?.fullName ?? null };
		});
		this.events.publish("health-record.changed", {
			childId: record.childId,
			resourceType: "health_record",
			resourceId: record.id,
		});

		return this.toResponse(record, recordedByName);
	}

	private toResponse(
		record: HealthRecord,
		recordedByName = record.recordedByStaff?.fullName ?? null,
	) {
		return {
			id: record.id,
			childId: record.childId,
			height: record.height,
			weight: record.weight,
			temperature: record.temperature,
			note: record.note,
			recordedAt: record.recordedAt.toISOString(),
			recordedByName,
			abnormal:
				record.temperature !== null &&
				(record.temperature >= 37.5 || record.temperature <= 35)
					? ["TEMPERATURE"]
					: [],
		};
	}
}
