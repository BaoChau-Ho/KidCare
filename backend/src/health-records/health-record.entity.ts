import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { Child } from "../children/child.entity";
import { User } from "../users/user.entity";

@Entity("health_records")
@Index("IDX_health_records_child_recorded_at", ["childId", "recordedAt"])
export class HealthRecord {
	@PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "PK_health_records" })
	id!: string;

	@Column({ name: "child_id", type: "uuid" })
	childId!: string;

	@ManyToOne(() => Child, { nullable: false, onDelete: "RESTRICT" })
	@JoinColumn({ name: "child_id", foreignKeyConstraintName: "FK_health_records_child" })
	child?: Child;

	@Column({ name: "recorded_by_staff_user_id", type: "uuid" })
	recordedByStaffUserId!: string;

	@ManyToOne(() => User, { nullable: false, onDelete: "RESTRICT" })
	@JoinColumn({
		name: "recorded_by_staff_user_id",
		foreignKeyConstraintName: "FK_health_records_recorded_by_staff",
	})
	recordedByStaff?: User;

	@Column({ type: "double precision", nullable: true })
	height!: number | null;

	@Column({ type: "double precision", nullable: true })
	weight!: number | null;

	@Column({ type: "double precision", nullable: true })
	temperature!: number | null;

	@Column({ type: "varchar", length: 2000, nullable: true })
	note!: string | null;

	@CreateDateColumn({ name: "recorded_at", type: "timestamptz" })
	recordedAt!: Date;
}
