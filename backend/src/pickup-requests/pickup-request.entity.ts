import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export type PickupStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "COMPLETED";

@Entity("pickup_requests")
@Index("IDX_pickup_requests_child_expected", ["childId", "expectedTime"])
@Index("IDX_pickup_requests_status_expected", ["status", "expectedTime"])
export class PickupRequest {
	@PrimaryGeneratedColumn("uuid") id!: string;
	@Column({ name: "child_id", type: "uuid" }) childId!: string;
	@Column({ name: "requester_user_id", type: "uuid" }) requesterUserId!: string;
	@Column({ name: "pickup_person", type: "varchar", length: 150 }) pickupPerson!: string;
	@Column({ type: "varchar", length: 50 }) relationship!: string;
	@Column({ name: "id_number", type: "varchar", length: 12 }) idNumber!: string;
	@Column({ type: "varchar", length: 20, nullable: true }) phone!: string | null;
	@Column({ name: "expected_time", type: "timestamptz" }) expectedTime!: Date;
	@Column({ type: "varchar", length: 20, default: "PENDING" }) status!: PickupStatus;
	@Column({ name: "verified_by_teacher_user_id", type: "uuid", nullable: true }) verifiedByTeacherUserId!: string | null;
	@Column({ name: "decision_reason", type: "varchar", length: 500, nullable: true }) decisionReason!: string | null;
	@Column({ name: "decided_at", type: "timestamptz", nullable: true }) decidedAt!: Date | null;
	@Column({ name: "completed_at", type: "timestamptz", nullable: true }) completedAt!: Date | null;
	@CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" }) updatedAt!: Date;
}
