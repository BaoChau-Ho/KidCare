import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
} from "typeorm";

@Entity("audit_logs")
@Index("IDX_audit_logs_actor_created", ["actorUserId", "createdAt"])
@Index("IDX_audit_logs_resource", ["resourceType", "resourceId"])
export class AuditLog {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "actor_user_id", type: "uuid", nullable: true })
	actorUserId!: string | null;

	// Lưu tên tại thời điểm thao tác để log vẫn dễ đọc nếu tài khoản đổi tên.
	@Column({ name: "actor_name", type: "varchar", length: 100, nullable: true })
	actorName!: string | null;

	@Column({ type: "varchar", length: 100 })
	action!: string;

	@Column({ name: "resource_type", type: "varchar", length: 100 })
	resourceType!: string;

	@Column({ name: "resource_id", type: "uuid" })
	resourceId!: string;

	@Column({ name: "old_value", type: "jsonb", nullable: true })
	oldValue!: Record<string, unknown> | null;

	@Column({ name: "new_value", type: "jsonb", nullable: true })
	newValue!: Record<string, unknown> | null;

	@Column({ name: "ip_address", type: "varchar", length: 45, nullable: true })
	ipAddress!: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}