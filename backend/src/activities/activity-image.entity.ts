import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("activity_images")
@Index("IDX_activity_images_activity_created", ["activityId", "createdAt"])
export class ActivityImage {
	@PrimaryGeneratedColumn("uuid") id!: string;
	@Column({ name: "activity_id", type: "uuid" }) activityId!: string;
	@Column({ name: "object_key", type: "varchar", length: 500, unique: true }) objectKey!: string;
	@Column({ name: "mime_type", type: "varchar", length: 30 }) mimeType!: string;
	@Column({ name: "original_name", type: "varchar", length: 255, nullable: true }) name!: string | null;
	@CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
}
