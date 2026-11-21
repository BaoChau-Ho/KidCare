import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { ChildAccessService } from "../access/child-access.service";
import type { AccessActor } from "../access/child-access.service";
import { addDays, todayInSchool } from "../common/school-time";
import { Child } from "../children/child.entity";
import { Allergy } from "./allergy.entity";
import { HealthRecord } from "./health-record.entity";
import { MedicalCondition } from "./medical-condition.entity";
import { MedicalVisit } from "./medical-visit.entity";
import { Vaccination } from "./vaccination.entity";

@Injectable()
export class HealthSummaryService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly access: ChildAccessService,
	) {}

	async get(childId: string, actor: AccessActor) {
		const child = await this.dataSource.getRepository(Child).findOne({
			where: { id: childId },
		});
		if (!child) {
			throw new NotFoundException({
				code: "CHILD_NOT_FOUND",
				message: "Không tìm thấy hồ sơ trẻ.",
			});
		}

		const view = await this.resolveView(child, actor);
		const [allergies, medicalConditions] = await Promise.all([
			this.dataSource.getRepository(Allergy).find({
				where: { childId, active: true },
				order: { createdAt: "DESC", id: "DESC" },
			}),
			this.dataSource.getRepository(MedicalCondition).find({
				where: { childId, active: true },
				order: { createdAt: "DESC", id: "DESC" },
			}),
		]);

		if (view === "ALERT_ONLY") {
			return {
				childId: child.id,
				childName: child.name,
				view,
				latestRecord: null,
				allergies: allergies.map(({ id, allergen, severity }) => ({
					id,
					allergen,
					severity,
				})),
				medicalConditions: medicalConditions.map(({ id, name }) => ({ id, name })),
				vaccinations: [],
				upcomingVaccinations: [],
				visits: [],
			};
		}

		const [latestRecord, vaccinations, visits] = await Promise.all([
			this.dataSource.getRepository(HealthRecord).findOne({
				where: { childId },
				relations: { recordedByStaff: true },
				select: {
					id: true,
					childId: true,
					height: true,
					weight: true,
					temperature: true,
					note: true,
					recordedAt: true,
					recordedByStaff: { id: true, fullName: true },
				},
				order: { recordedAt: "DESC", id: "DESC" },
			}),
			this.dataSource.getRepository(Vaccination).find({
				where: { childId },
				order: { vaccinatedAt: "DESC", id: "DESC" },
			}),
			this.dataSource.getRepository(MedicalVisit).find({
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
				take: 10,
			}),
		]);

		const abnormal = latestRecord?.temperature !== null && latestRecord?.temperature !== undefined &&
			(latestRecord.temperature >= 37.5 || latestRecord.temperature <= 35)
			? ["TEMPERATURE"]
			: [];
		const today = todayInSchool();
		const upcomingLimit = addDays(today, 30);
		const vaccinationItems = vaccinations.map((vaccination) => this.toVaccination(vaccination));

		return {
			childId: child.id,
			childName: child.name,
			view,
			latestRecord: latestRecord
				? this.toHealthRecord(latestRecord, view === "FULL", abnormal)
				: null,
			allergies: view === "FULL"
				? allergies.map((allergy) => ({
						id: allergy.id,
						childId: allergy.childId,
						allergen: allergy.allergen,
						severity: allergy.severity,
						note: allergy.note,
						active: allergy.active,
						createdAt: allergy.createdAt.toISOString(),
					}))
				: allergies.map(({ id, allergen, severity }) => ({ id, allergen, severity })),
			medicalConditions: view === "FULL"
				? medicalConditions.map((condition) => ({
						id: condition.id,
						childId: condition.childId,
						name: condition.name,
						note: condition.note,
						active: condition.active,
						createdAt: condition.createdAt.toISOString(),
					}))
				: medicalConditions.map(({ id, name }) => ({ id, name })),
			vaccinations: vaccinationItems,
			upcomingVaccinations: vaccinationItems.filter(
				(vaccination) =>
					vaccination.nextDueDate !== null && vaccination.nextDueDate <= upcomingLimit,
			),
			visits: visits.map((visit) => this.toVisit(visit, view === "FULL")),
			...(view === "FULL" ? { abnormal } : {}),
		};
	}

	private async resolveView(
		child: Child,
		actor: AccessActor,
	): Promise<"FULL" | "PARENT" | "ALERT_ONLY"> {
		if (actor.role === "MEDICAL_STAFF") return "FULL";
		if (actor.role === "PARENT") {
			await this.access.assertIsParentOf(child.id, actor);
			return "PARENT";
		}
		if (actor.role === "TEACHER") {
			await this.access.assertCanViewChild(child, actor);
			return "ALERT_ONLY";
		}
		throw new ForbiddenException({
			code: "ROLE_NOT_ALLOWED",
			message: "Vai trò này không được xem tóm tắt sức khỏe.",
		});
	}

	private toHealthRecord(
		record: HealthRecord,
		full: boolean,
		abnormal: string[],
	) {
		return {
			id: record.id,
			childId: record.childId,
			height: record.height,
			weight: record.weight,
			temperature: record.temperature,
			...(full ? { note: record.note } : {}),
			recordedAt: record.recordedAt.toISOString(),
			...(full
				? {
					recordedByName: record.recordedByStaff?.fullName ?? null,
					abnormal,
				}
				: {}),
		};
	}

	private toVaccination(vaccination: Vaccination) {
		return {
			id: vaccination.id,
			childId: vaccination.childId,
			vaccineName: vaccination.vaccineName,
			doseNumber: vaccination.doseNumber,
			vaccinatedAt: vaccination.vaccinatedAt,
			nextDueDate: vaccination.nextDueDate,
		};
	}

	private toVisit(visit: MedicalVisit, full: boolean) {
		return {
			id: visit.id,
			childId: visit.childId,
			visitedAt: visit.visitedAt.toISOString(),
			symptoms: visit.symptoms,
			...(full ? { conclusion: visit.conclusion } : {}),
			...(full ? { examinerName: visit.recordedByStaff?.fullName ?? null } : {}),
			medications: (visit.medications ?? []).map(({ name, dosage, schedule }) => ({
				name,
				dosage,
				schedule,
			})),
		};
	}
}
