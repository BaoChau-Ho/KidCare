import {
	Check,
	Column,
	CreateDateColumn,
	Entity,
	Exclusion,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { Child } from "../children/child.entity";
import { User } from "../users/user.entity";

export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

// Hai đơn còn hiệu lực (PENDING hoặc APPROVED) của cùng một trẻ không được giao nhau về ngày.
// Service kiểm tra trước để báo lỗi rõ ràng; ràng buộc loại trừ này chặn trường hợp hai request gửi cùng lúc.
// Cần extension btree_gist (migration đã tạo).
@Entity("leave_requests")
@Index("IDX_leave_requests_child_dates", ["childId", "fromDate", "toDate"])
@Index("IDX_leave_requests_status_created", ["status", "createdAt"])
@Check("CHK_leave_requests_dates", `"to_date" >= "from_date"`)
@Check("CHK_leave_requests_status", `"status" IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')`)
@Exclusion(
	"EXC_leave_requests_no_overlap",
	`USING gist ("child_id" WITH =, daterange("from_date", "to_date", '[]') WITH &&) WHERE ("status" IN ('PENDING', 'APPROVED'))`,
)
export class LeaveRequest {
	@PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "PK_leave_requests" })
	id!: string;

	@Column({ name: "child_id", type: "uuid" })
	childId!: string;

	@ManyToOne(() => Child, { nullable: false, onDelete: "RESTRICT" })
	@JoinColumn({ name: "child_id", foreignKeyConstraintName: "FK_leave_requests_child" })
	child?: Child;

	@Column({ name: "parent_user_id", type: "uuid" })
	parentUserId!: string;

	@ManyToOne(() => User, { nullable: false, onDelete: "RESTRICT" })
	@JoinColumn({ name: "parent_user_id", foreignKeyConstraintName: "FK_leave_requests_parent" })
	parent?: User;

	@Column({ name: "from_date", type: "date" })
	fromDate!: string;

	@Column({ name: "to_date", type: "date" })
	toDate!: string;

	@Column({ type: "varchar", length: 1000 })
	reason!: string;

	@Column({ type: "varchar", length: 20, default: "PENDING" })
	status!: LeaveRequestStatus;

	@Column({ name: "decided_by_user_id", type: "uuid", nullable: true })
	decidedByUserId!: string | null;

	@ManyToOne(() => User, { nullable: true, onDelete: "RESTRICT" })
	@JoinColumn({ name: "decided_by_user_id", foreignKeyConstraintName: "FK_leave_requests_decided_by" })
	decidedBy?: User | null;

	@Column({ name: "decided_at", type: "timestamptz", nullable: true })
	decidedAt!: Date | null;

	@Column({ name: "decision_reason", type: "varchar", length: 500, nullable: true })
	decisionReason!: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
