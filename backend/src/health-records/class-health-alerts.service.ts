import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { DataSource, In } from "typeorm";
import { ChildAccessService } from "../access/child-access.service";
import type { AccessActor } from "../access/child-access.service";
import { Child } from "../children/child.entity";
import { Classroom } from "../classes/class.entity";
import { Allergy } from "./allergy.entity";
import { MedicalCondition } from "./medical-condition.entity";

@Injectable()
export class ClassHealthAlertsService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly access: ChildAccessService,
	) {}

	async list(classId: string, actor: AccessActor) {
		if (actor.role !== "TEACHER" && actor.role !== "MANAGER" && actor.role !== "MEDICAL_STAFF") {
			throw new ForbiddenException({
				code: "CLASS_HEALTH_ALERTS_ACCESS_DENIED",
				message: "Bạn không được xem cảnh báo sức khỏe của lớp.",
			});
		}

		const classroomExists = await this.dataSource.getRepository(Classroom).exist({
			where: { id: classId },
		});
		if (!classroomExists) {
			throw new NotFoundException({
				code: "CLASS_NOT_FOUND",
				message: "Không tìm thấy lớp học.",
			});
		}
		if (actor.role === "TEACHER") {
			await this.access.assertCanAccessClass(classId, actor);
		}

		const children = await this.dataSource.getRepository(Child).find({
			where: { classId, status: "ACTIVE" },
			select: { id: true, name: true },
			order: { name: "ASC", id: "ASC" },
		});
		if (!children.length) return [];

		const childIds = children.map((child) => child.id);
		const childNames = new Map(children.map((child) => [child.id, child.name]));
		const [allergies, conditions] = await Promise.all([
			this.dataSource.getRepository(Allergy).find({
				where: { childId: In(childIds), active: true },
				select: { id: true, childId: true, allergen: true, severity: true },
			}),
			this.dataSource.getRepository(MedicalCondition).find({
				where: { childId: In(childIds), active: true },
				select: { id: true, childId: true, name: true },
			}),
		]);

		return [
			...allergies.map((allergy) => ({
				childId: allergy.childId,
				childName: childNames.get(allergy.childId)!,
				kind: "ALLERGY" as const,
				allergen: allergy.allergen,
				severity: allergy.severity,
			})),
			...conditions.map((condition) => ({
				childId: condition.childId,
				childName: childNames.get(condition.childId)!,
				kind: "CONDITION" as const,
				allergen: condition.name,
				severity: null,
			})),
		].sort(
			(left, right) =>
				left.childName.localeCompare(right.childName) ||
				left.kind.localeCompare(right.kind) ||
				left.allergen.localeCompare(right.allergen),
		);
	}
}
