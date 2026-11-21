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
import { CreateMedicalVisitDto } from "./dto/create-medical-visit.dto";
import { ListMedicalVisitsQueryDto } from "./dto/list-medical-visits-query.dto";
import { MedicalVisit } from "./medical-visit.entity";
import { Medication } from "./medication.entity";
import { DomainEventPublisher } from "../common/domain-events/domain-event.publisher";

@Injectable()
export class MedicalVisitsService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly access: ChildAccessService,
		private readonly auditLogsService: AuditLogsService,
		private readonly events: DomainEventPublisher,
	) {}

	async create(
		childId: string,
		dto: CreateMedicalVisitDto,
		actor: AccessActor,
		ipAddress: string | null,
	) {
		this.assertMedicalStaff(actor);
		const symptoms = dto.symptoms?.trim() || null;
		const conclusion = dto.conclusion?.trim() || null;
		if (!symptoms && !conclusion) {
			throw new BadRequestException({
				code: "MEDICAL_VISIT_DETAILS_REQUIRED",
				message: "Cần nhập triệu chứng hoặc kết luận khám.",
			});
		}

		const visitedAt = dto.visitedAt ? new Date(dto.visitedAt) : new Date();
		if (!Number.isFinite(visitedAt.getTime())) {
			throw this.invalidVisitedAt();
		}
		if (visitedAt.getTime() > Date.now()) {
			throw new BadRequestException({
				code: "MEDICAL_VISIT_DATE_IN_FUTURE",
				message: "Thời điểm khám không được ở tương lai.",
				field: "visitedAt",
			});
		}

		const medicationsInput = dto.medications ?? [];
		const visit = await this.dataSource.transaction(async (manager) => {
			const child = await manager.getRepository(Child).findOne({
				where: { id: childId },
				lock: { mode: "pessimistic_write" },
			});
			if (!child) throw this.childNotFound();

			const visitRepository = manager.getRepository(MedicalVisit);
			const savedVisit = await visitRepository.save(
				visitRepository.create({
					childId: child.id,
					recordedByStaffUserId: actor.id,
					visitedAt,
					symptoms,
					conclusion,
				}),
			);

			const medicationRepository = manager.getRepository(Medication);
			const medications = medicationsInput.length
				? await medicationRepository.save(
						medicationsInput.map((medication) =>
							medicationRepository.create({
								medicalVisitId: savedVisit.id,
								name: medication.name.trim(),
								dosage: medication.dosage.trim(),
								schedule: medication.schedule.trim(),
							}),
						),
					)
				: [];

			// Audit log chỉ lưu metadata, không lưu triệu chứng, kết luận hay tên thuốc.
			await this.auditLogsService.record(manager, {
				actorUserId: actor.id,
				actorName: actor.fullName,
				action: "CREATE_MEDICAL_VISIT",
				resourceType: "medical_visit",
				resourceId: savedVisit.id,
				oldValue: null,
				newValue: {
					childId: child.id,
					visitedAt: savedVisit.visitedAt.toISOString(),
					hasSymptoms: symptoms !== null,
					hasConclusion: conclusion !== null,
					medicationCount: medications.length,
				},
				ipAddress,
			});

			return { ...savedVisit, medications };
		});
		this.events.publish("health-record.changed", {
			childId: visit.childId,
			resourceType: "medical_visit",
			resourceId: visit.id,
		});

		return this.toResponse(visit, actor.fullName);
	}

	async list(
		childId: string,
		query: ListMedicalVisitsQueryDto,
		actor: AccessActor,
	) {
		this.assertMedicalStaff(actor);
		const childExists = await this.dataSource.getRepository(Child).exist({
			where: { id: childId },
		});
		if (!childExists) throw this.childNotFound();

		const [visits, totalItems] = await this.dataSource
			.getRepository(MedicalVisit)
			.findAndCount({
				where: { childId },
				relations: { recordedByStaff: true, medications: true },
				select: {
					id: true,
					childId: true,
					visitedAt: true,
					symptoms: true,
					conclusion: true,
					recordedByStaff: { id: true, fullName: true },
					medications: {
						id: true,
						medicalVisitId: true,
						name: true,
						dosage: true,
						schedule: true,
					},
				},
				order: { visitedAt: "DESC", id: "DESC" },
				skip: (query.page - 1) * query.limit,
				take: query.limit,
			});

		return {
			items: visits.map((visit) =>
				this.toResponse(visit, visit.recordedByStaff?.fullName ?? null),
			),
			pageInfo: {
				page: query.page,
				limit: query.limit,
				totalItems,
				totalPages: Math.ceil(totalItems / query.limit),
			},
		};
	}

	private assertMedicalStaff(actor: AccessActor) {
		this.access.assertRole(
			actor,
			["MEDICAL_STAFF"],
			"Chỉ nhân viên y tế được quản lý hồ sơ khám.",
		);
	}

	private toResponse(visit: MedicalVisit, examinerName: string | null) {
		return {
			id: visit.id,
			childId: visit.childId,
			visitedAt: visit.visitedAt.toISOString(),
			symptoms: visit.symptoms,
			conclusion: visit.conclusion,
			examinerName,
			medications: (visit.medications ?? []).map((medication) => ({
				id: medication.id,
				name: medication.name,
				dosage: medication.dosage,
				schedule: medication.schedule,
			})),
		};
	}

	private invalidVisitedAt() {
		return new BadRequestException({
			code: "INVALID_MEDICAL_VISIT_DATE",
			message: "Thời điểm khám không hợp lệ.",
			field: "visitedAt",
		});
	}

	private childNotFound() {
		return new NotFoundException({
			code: "CHILD_NOT_FOUND",
			message: "Không tìm thấy hồ sơ trẻ.",
		});
	}
}
