import { Column, Entity, PrimaryColumn } from "typeorm";

export type ParticipationStatus = "JOINED" | "NOT_JOINED";

@Entity("activity_participants")
export class ActivityParticipant {
	@PrimaryColumn({ name: "activity_id", type: "uuid" }) activityId!: string;
	@PrimaryColumn({ name: "child_id", type: "uuid" }) childId!: string;
	@Column({ name: "participation_status", type: "varchar", length: 20 }) participationStatus!: ParticipationStatus;
}
