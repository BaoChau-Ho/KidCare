import { ForbiddenException, Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { ChildParent } from "../children/child-parent.entity";
import { ClassTeacher } from "../classes/class-teacher.entity";
import { User } from "../users/user.entity";

export type AccessActor = Pick<User, "id" | "email" | "fullName" | "role">;
type Role = User["role"];

/**
 * Kiểm tra "dữ liệu này có thuộc về người đang hỏi không", không chỉ kiểm tra vai trò (chống IDOR).
 * Dùng chung cho điểm danh và đơn nghỉ.
 */
@Injectable()
export class ChildAccessService {
	constructor(private readonly dataSource: DataSource) {}

	assertRole(actor: AccessActor, roles: Role[], message: string) {
		if (!roles.includes(actor.role)) {
			throw new ForbiddenException({ code: "ROLE_NOT_ALLOWED", message });
		}
	}

	/** MANAGER được phép; TEACHER chỉ khi được phân công vào lớp. */
	async assertCanAccessClass(classId: string, actor: AccessActor, manager?: EntityManager) {
		if (actor.role === "MANAGER") return;
		if (actor.role === "TEACHER" && await this.isTeacherOfClass(classId, actor.id, manager)) return;
		throw new ForbiddenException({ code: "CLASS_ACCESS_DENIED", message: "Bạn không phụ trách lớp này." });
	}

	/** MANAGER; TEACHER của lớp chứa trẻ; PARENT đã liên kết với trẻ. */
	async assertCanViewChild(child: { id: string; classId: string }, actor: AccessActor, manager?: EntityManager) {
		if (actor.role === "MANAGER") return;
		if (actor.role === "TEACHER" && await this.isTeacherOfClass(child.classId, actor.id, manager)) return;
		if (actor.role === "PARENT" && await this.isParentOf(child.id, actor.id, manager)) return;
		throw new ForbiddenException({ code: "CHILD_ACCESS_DENIED", message: "Bạn không được truy cập hồ sơ trẻ này." });
	}

	async assertIsParentOf(childId: string, actor: AccessActor, manager?: EntityManager) {
		if (actor.role === "PARENT" && await this.isParentOf(childId, actor.id, manager)) return;
		throw new ForbiddenException({ code: "CHILD_ACCESS_DENIED", message: "Bạn không được truy cập hồ sơ trẻ này." });
	}

	async teacherClassIds(teacherUserId: string): Promise<string[]> {
		const rows = await this.dataSource.getRepository(ClassTeacher).findBy({ teacherUserId });
		return rows.map((row) => row.classId);
	}

	private isTeacherOfClass(classId: string, teacherUserId: string, manager?: EntityManager) {
		return (manager ?? this.dataSource.manager).getRepository(ClassTeacher).exist({ where: { classId, teacherUserId } });
	}

	private isParentOf(childId: string, parentUserId: string, manager?: EntityManager) {
		return (manager ?? this.dataSource.manager).getRepository(ChildParent).exist({ where: { childId, parentUserId } });
	}
}
