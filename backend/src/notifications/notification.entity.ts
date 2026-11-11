import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("notifications")
@Index("IDX_notifications_recipient_created", { synchronize: false })
export class Notification {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "recipient_user_id", type: "uuid" })
	recipientUserId!: string;

	@Column({ name: "sender_user_id", type: "uuid", nullable: true })
	senderUserId!: string | null;

	@Column({ type: "varchar", length: 30 })
	type!: string;

	@Column({ type: "varchar", length: 200 })
	title!: string;

	@Column({ type: "varchar", length: 5000 })
	content!: string;

	@Column({ name: "related_type", type: "varchar", length: 50, nullable: true })
	relatedType!: string | null;

	@Column({ name: "related_id", type: "uuid", nullable: true })
	relatedId!: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@Column({ name: "read_at", type: "timestamptz", nullable: true })
	readAt!: Date | null;
}
