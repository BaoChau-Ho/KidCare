import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("activities")
@Index("IDX_activities_class_date", ["classId", "date"])
export class Activity {
	@PrimaryGeneratedColumn("uuid") id!: string;
	@Column({ name: "class_id", type: "uuid" }) classId!: string;
	@Column({ name: "created_by_teacher_user_id", type: "uuid" }) createdByTeacherUserId!: string;
	@Column({ type: "varchar", length: 200 }) title!: string;
	@Column({ type: "varchar", length: 5000, nullable: true }) description!: string | null;
	@Column({ type: "date" }) date!: string;
	@CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
}
