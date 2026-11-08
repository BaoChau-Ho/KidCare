import {
	Check,
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	Unique,
	UpdateDateColumn,
} from "typeorm";
import { Child } from "../children/child.entity";
import { User } from "../users/user.entity";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EARLY_LEAVE";

// Mỗi trẻ chỉ có một bản ghi mỗi ngày. Ràng buộc nằm ở database (lớp bảo vệ cuối cùng khi hai giáo viên
// bấm cùng lúc), không chỉ kiểm tra trong code.
@Entity("attendance")
@Unique("UQ_attendance_child_date", ["childId", "date"])
@Index("IDX_attendance_date_child", ["date", "childId"])
@Check("CHK_attendance_status", `"status" IN ('PRESENT', 'ABSENT', 'LATE', 'EARLY_LEAVE')`)
@Check("CHK_attendance_times", `"check_out_time" IS NULL OR ("check_in_time" IS NOT NULL AND "check_out_time" >= "check_in_time")`)
@Check("CHK_attendance_absent_has_no_times", `"status" <> 'ABSENT' OR ("check_in_time" IS NULL AND "check_out_time" IS NULL)`)
export class Attendance {
	@PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "PK_attendance" })
	id!: string;

	@Column({ name: "child_id", type: "uuid" })
	childId!: string;

	@ManyToOne(() => Child, { nullable: false, onDelete: "RESTRICT" })
	@JoinColumn({ name: "child_id", foreignKeyConstraintName: "FK_attendance_child" })
	child?: Child;

	@Column({ type: "date" })
	date!: string;

	@Column({ type: "varchar", length: 20 })
	status!: AttendanceStatus;

	@Column({ name: "check_in_time", type: "timestamptz", nullable: true })
	checkInTime!: Date | null;

	@Column({ name: "check_out_time", type: "timestamptz", nullable: true })
	checkOutTime!: Date | null;

	@Column({ name: "recorded_by_user_id", type: "uuid" })
	recordedByUserId!: string;

	@ManyToOne(() => User, { nullable: false, onDelete: "RESTRICT" })
	@JoinColumn({ name: "recorded_by_user_id", foreignKeyConstraintName: "FK_attendance_recorded_by" })
	recordedBy?: User;

	@Column({ name: "checked_out_by_user_id", type: "uuid", nullable: true })
	checkedOutByUserId!: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
