import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
} from "typeorm";

export type UserRole =
	"PARENT" | "TEACHER" | "MEDICAL_STAFF" | "MANAGER" | "ADMIN";
export type UserStatus = "ACTIVE" | "LOCKED" | "INACTIVE";

@Entity("users")
export class User {
	@PrimaryGeneratedColumn("uuid")
	id: string;

	@Column({ unique: true })
	email: string;

	@Column({ name: "password_hash" })
	passwordHash: string;

	@Column({
		name: "full_name",
		type: "varchar",
		length: 100,
		nullable: true,
	})
	fullName: string | null;

	@Column({ type: "varchar", length: 20, default: "PARENT" })
	role: UserRole;

	@Column({ type: "varchar", length: 20, default: "ACTIVE" })
	status: UserStatus;

	@Column({ type: "varchar", length: 20, nullable: true })
	phone: string | null;

	@Column({
		name: "national_id",
		type: "varchar",
		length: 12,
		nullable: true,
		unique: true,
	})
	nationalId: string | null;

	@CreateDateColumn({ name: "created_at" })
	createdAt: Date;
}
