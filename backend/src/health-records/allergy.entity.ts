import {
	Check,
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { Child } from "../children/child.entity";

export type AllergySeverity = "MILD" | "MODERATE" | "SEVERE";

@Entity("allergies")
@Index("IDX_allergies_child_active", ["childId", "active"])
@Index("IDX_allergies_child_created_at", ["childId", "createdAt"])
@Check("CHK_allergies_severity", `"severity" IN ('MILD', 'MODERATE', 'SEVERE')`)
export class Allergy {
	@PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "PK_allergies" })
	id!: string;

	@Column({ name: "child_id", type: "uuid" })
	childId!: string;

	@ManyToOne(() => Child, { nullable: false, onDelete: "RESTRICT" })
	@JoinColumn({ name: "child_id", foreignKeyConstraintName: "FK_allergies_child" })
	child?: Child;

	@Column({ type: "varchar", length: 200 })
	allergen!: string;

	@Column({ type: "varchar", length: 20 })
	severity!: AllergySeverity;

	@Column({ type: "varchar", length: 2000, nullable: true })
	note!: string | null;

	@Column({ type: "boolean", default: true })
	active!: boolean;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
