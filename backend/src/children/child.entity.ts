import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";

export type ChildStatus = "ACTIVE" | "INACTIVE" | "WITHDRAWN";
export type ChildGender = "MALE" | "FEMALE" | "OTHER";

@Entity("children")
@Index("IDX_children_class_status", ["classId", "status"])
export class Child {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ type: "varchar", length: 150 })
	name!: string;

	@Column({ name: "date_of_birth", type: "date" })
	dateOfBirth!: string;

	@Column({ type: "varchar", length: 10 })
	gender!: ChildGender;

	@Column({ type: "varchar", length: 500, nullable: true })
	address!: string | null;

	@Column({ name: "avatar_url", type: "varchar", length: 2048, nullable: true })
	avatarUrl!: string | null;

	@Column({ name: "class_id", type: "uuid" })
	classId!: string;

	@Column({ type: "varchar", length: 20, default: "ACTIVE" })
	status!: ChildStatus;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
