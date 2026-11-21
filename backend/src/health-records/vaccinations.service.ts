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
import { isValidDateString, todayInSchool } from "../common/school-time";
import { CreateVaccinationDto } from "./dto/create-vaccination.dto";
import { ListVaccinationsQueryDto } from "./dto/list-vaccinations-query.dto";
import { Vaccination } from "./vaccination.entity";
import { DomainEventPublisher } from "../common/domain-events/domain-event.publisher";

@Injectable()
export class VaccinationsService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly access: ChildAccessService,
		private readonly auditLogsService: AuditLogsService,
		private readonly events: DomainEventPublisher,
	) {}

	async create(
		childId: string,
		dto: CreateVaccinationDto,
		actor: AccessActor,
		ipAddress: string | null,
	) {
		this.assertMedicalStaff(actor);
		this.validateDates(dto.vaccinatedAt, dto.nextDueDate);
		const vaccineName = dto.vaccineName.trim();

		const vaccination = await this.dataSource.transaction(async (manager) => {
			// Khóa trẻ để hai request đồng thời không tạo trùng cùng tên vắc-xin và số mũi.
			const child = await manager.getRepository(Child).findOne({
				where: { id: childId },
				lock: { mode: "pessimistic_write" },
			});
			if (!child) throw this.childNotFound();

			const repository = manager.getRepository(Vaccination);
			if (
				await this.hasDuplicate(
					repository,
					child.id,
					vaccineName,
					dto.doseNumber,
				)
			) {
				throw this.duplicateError();
			}

			const saved = await repository.save(
				repository.create({
					childId: child.id,
					vaccineName,
					doseNumber: dto.doseNumber,
					vaccinatedAt: dto.vaccinatedAt,
					nextDueDate: dto.nextDueDate ?? null,
				}),
			);
			await this.auditLogsService.record(manager, {
				actorUserId: actor.id,
				actorName: actor.fullName,
				action: "CREATE_VACCINATION",
				resourceType: "vaccination",
				resourceId: saved.id,
				oldValue: null,
				// Chỉ ghi metadata lịch tiêm, không đưa tên vắc-xin vào audit log.
				newValue: {
					childId: child.id,
					doseNumber: saved.doseNumber,
					vaccinatedAt: saved.vaccinatedAt,
					nextDueDate: saved.nextDueDate,
				},
				ipAddress,
			});
			return saved;
		});
		this.events.publish("health-record.changed", {
			childId: vaccination.childId,
			resourceType: "vaccination",
			resourceId: vaccination.id,
		});

		return this.toResponse(vaccination);
	}

	async list(
		childId: string,
		query: ListVaccinationsQueryDto,
		actor: AccessActor,
	) {
		this.assertMedicalStaff(actor);
		const childExists = await this.dataSource.getRepository(Child).exist({
			where: { id: childId },
		});
		if (!childExists) throw this.childNotFound();

		const [vaccinations, totalItems] = await this.dataSource
			.getRepository(Vaccination)
			.findAndCount({
				where: { childId },
				order: { vaccinatedAt: "DESC", id: "DESC" },
				skip: (query.page - 1) * query.limit,
				take: query.limit,
			});

		return {
			items: vaccinations.map((vaccination) => this.toResponse(vaccination)),
			pageInfo: {
				page: query.page,
				limit: query.limit,
				totalItems,
				totalPages: Math.ceil(totalItems / query.limit),
			},
		};
	}

	private validateDates(vaccinatedAt: string, nextDueDate?: string) {
		if (!isValidDateString(vaccinatedAt)) {
			throw this.invalid("Ngày tiêm không hợp lệ.", "vaccinatedAt");
		}
		if (vaccinatedAt > todayInSchool()) {
			throw this.invalid("Ngày tiêm không được ở tương lai.", "vaccinatedAt");
		}
		if (nextDueDate !== undefined) {
			if (!isValidDateString(nextDueDate)) {
				throw this.invalid("Ngày hẹn tiêm không hợp lệ.", "nextDueDate");
			}
			if (nextDueDate <= vaccinatedAt) {
				throw this.invalid("Ngày hẹn phải sau ngày tiêm.", "nextDueDate");
			}
		}
	}

	private async hasDuplicate(
		repository: Repository<Vaccination>,
		childId: string,
		vaccineName: string,
		doseNumber: number,
	): Promise<boolean> {
		return repository
			.createQueryBuilder("vaccination")
			.where("vaccination.childId = :childId", { childId })
			.andWhere("LOWER(vaccination.vaccineName) = LOWER(:vaccineName)", {
				vaccineName,
			})
			.andWhere("vaccination.doseNumber = :doseNumber", { doseNumber })
			.getExists();
	}

	private assertMedicalStaff(actor: AccessActor) {
		this.access.assertRole(
			actor,
			["MEDICAL_STAFF"],
			"Chỉ nhân viên y tế được quản lý lịch tiêm chủng.",
		);
	}

	private toResponse(vaccination: Vaccination) {
		return {
			id: vaccination.id,
			childId: vaccination.childId,
			vaccineName: vaccination.vaccineName,
			doseNumber: vaccination.doseNumber,
			vaccinatedAt: vaccination.vaccinatedAt,
			nextDueDate: vaccination.nextDueDate,
		};
	}

	private invalid(message: string, field: string) {
		return new BadRequestException({
			code: "INVALID_VACCINATION_DATE",
			message,
			field,
		});
	}

	private childNotFound() {
		return new NotFoundException({
			code: "CHILD_NOT_FOUND",
			message: "Không tìm thấy hồ sơ trẻ.",
		});
	}

	private duplicateError() {
		return new ConflictException({
			code: "VACCINATION_ALREADY_EXISTS",
			message: "Đã ghi nhận vắc-xin này ở số mũi đó cho trẻ.",
		});
	}
}
