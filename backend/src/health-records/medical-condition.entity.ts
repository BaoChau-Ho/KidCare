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

@Entity("medical_conditions")
@Index("IDX_medical_conditions_child_active", ["childId", "active"])
@Index("IDX_medical_conditions_child_created_at", ["childId", "createdAt"])
export class MedicalCondition {
	@PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "PK_medical_conditions" })
	id!: string;

	@Column({ name: "child_id", type: "uuid" })
	childId!: string;

	@ManyToOne(() => Child, { nullable: false, onDelete: "RESTRICT" })
	@JoinColumn({ name: "child_id", foreignKeyConstraintName: "FK_medical_conditions_child" })
	child?: Child;

	@Column({ type: "varchar", length: 200 })
	name!: string;

	@Column({ type: "varchar", length: 2000, nullable: true })
	note!: string | null;

	@Column({ type: "boolean", default: true })
	active!: boolean;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
