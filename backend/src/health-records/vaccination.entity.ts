import {
	Check,
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { Child } from "../children/child.entity";

@Entity("vaccinations")
@Index("IDX_vaccinations_child_vaccinated_at", ["childId", "vaccinatedAt"])
@Check("CHK_vaccinations_dose_number", `"dose_number" BETWEEN 1 AND 10`)
@Check(
	"CHK_vaccinations_next_due_after_vaccinated",
	`"next_due_date" IS NULL OR "next_due_date" > "vaccinated_at"`,
)
export class Vaccination {
	@PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "PK_vaccinations" })
	id!: string;

	@Column({ name: "child_id", type: "uuid" })
	childId!: string;

	@ManyToOne(() => Child, { nullable: false, onDelete: "RESTRICT" })
	@JoinColumn({ name: "child_id", foreignKeyConstraintName: "FK_vaccinations_child" })
	child?: Child;

	@Column({ name: "vaccine_name", type: "varchar", length: 200 })
	vaccineName!: string;

	@Column({ name: "dose_number", type: "integer" })
	doseNumber!: number;

	@Column({ name: "vaccinated_at", type: "date" })
	vaccinatedAt!: string;

	@Column({ name: "next_due_date", type: "date", nullable: true })
	nextDueDate!: string | null;
}
