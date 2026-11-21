import {
	Check,
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
} from "typeorm";
import { Child } from "../children/child.entity";
import { User } from "../users/user.entity";
import { Medication } from "./medication.entity";

@Entity("medical_visits")
@Index("IDX_medical_visits_child_visited_at", ["childId", "visitedAt"])
@Check(
	"CHK_medical_visits_has_details",
	`"symptoms" IS NOT NULL OR "conclusion" IS NOT NULL`,
)
export class MedicalVisit {
	@PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "PK_medical_visits" })
	id!: string;

	@Column({ name: "child_id", type: "uuid" })
	childId!: string;

	@ManyToOne(() => Child, { nullable: false, onDelete: "RESTRICT" })
	@JoinColumn({ name: "child_id", foreignKeyConstraintName: "FK_medical_visits_child" })
	child?: Child;

	@Column({ name: "recorded_by_staff_user_id", type: "uuid" })
	recordedByStaffUserId!: string;

	@ManyToOne(() => User, { nullable: false, onDelete: "RESTRICT" })
	@JoinColumn({
		name: "recorded_by_staff_user_id",
		foreignKeyConstraintName: "FK_medical_visits_recorded_by_staff",
	})
	recordedByStaff?: User;

	@Column({ name: "visited_at", type: "timestamptz" })
	visitedAt!: Date;

	@Column({ type: "varchar", length: 2000, nullable: true })
	symptoms!: string | null;

	@Column({ type: "varchar", length: 2000, nullable: true })
	conclusion!: string | null;

	@OneToMany(() => Medication, (medication) => medication.medicalVisit)
	medications?: Medication[];

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
