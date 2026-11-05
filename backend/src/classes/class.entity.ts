import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";

export type ClassStatus = "ACTIVE" | "CLOSED";

@Entity("classes")
@Index("UQ_classes_name_academic_year", ["name", "academicYear"], {
	unique: true,
})
export class Classroom {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ type: "varchar", length: 100 })
	name!: string;

	@Column({ name: "academic_year", type: "varchar", length: 20 })
	academicYear!: string;

	@Column({ type: "varchar", length: 20, default: "ACTIVE" })
	status!: ClassStatus;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
