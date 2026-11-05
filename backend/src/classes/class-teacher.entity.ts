import { CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

@Entity("class_teachers")
export class ClassTeacher {
	@PrimaryColumn({ name: "class_id", type: "uuid" })
	classId!: string;

	@PrimaryColumn({ name: "teacher_user_id", type: "uuid" })
	teacherUserId!: string;

	@CreateDateColumn({ name: "assigned_at", type: "timestamptz" })
	assignedAt!: Date;
}
