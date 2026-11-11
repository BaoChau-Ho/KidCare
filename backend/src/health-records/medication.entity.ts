import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { MedicalVisit } from "./medical-visit.entity";

@Entity("medications")
@Index("IDX_medications_medical_visit", ["medicalVisitId"])
export class Medication {
	@PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "PK_medications" })
	id!: string;

	@Column({ name: "medical_visit_id", type: "uuid" })
	medicalVisitId!: string;

	@ManyToOne(() => MedicalVisit, (visit) => visit.medications, {
		nullable: false,
		onDelete: "CASCADE",
	})
	@JoinColumn({ name: "medical_visit_id", foreignKeyConstraintName: "FK_medications_medical_visit" })
	medicalVisit?: MedicalVisit;

	@Column({ type: "varchar", length: 200 })
	name!: string;

	@Column({ type: "varchar", length: 200 })
	dosage!: string;

	@Column({ type: "varchar", length: 200 })
	schedule!: string;
}
