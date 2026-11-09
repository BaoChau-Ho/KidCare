import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Stage 3 — điểm danh (UC-06/07) và đơn xin nghỉ (UC-08).
 * Tạo bảng `attendance` và `leave_requests` cùng khóa ngoại, ràng buộc duy nhất, CHECK, ràng buộc loại trừ và chỉ mục.
 *
 * - Khóa chính dùng `gen_random_uuid()` cho khớp `uuidExtension: 'pgcrypto'` trong DatabaseModule.
 * - Cần extension `btree_gist` cho ràng buộc "không có hai đơn nghỉ giao nhau" (PostgreSQL 13+ cho phép
 *   người dùng không phải superuser tạo vì extension này được đánh dấu trusted).
 * - Tên ràng buộc/chỉ mục được đặt tường minh và khớp với entity.
 * - Đặt file này vào src/database/migrations/ và kiểm tra timestamp đứng sau migration Stage 2.
 */
export class Stage3AttendanceAndLeave1794009600000 implements MigrationInterface {
	name = "Stage3AttendanceAndLeave1794009600000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
		await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "btree_gist"`);

		// ---- attendance -----------------------------------------------------
		await queryRunner.query(`
			CREATE TABLE "attendance" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"child_id" uuid NOT NULL,
				"date" date NOT NULL,
				"status" character varying(20) NOT NULL,
				"check_in_time" TIMESTAMP WITH TIME ZONE,
				"check_out_time" TIMESTAMP WITH TIME ZONE,
				"recorded_by_user_id" uuid NOT NULL,
				"checked_out_by_user_id" uuid,
				"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				CONSTRAINT "PK_attendance" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_attendance_child_date" UNIQUE ("child_id", "date"),
				CONSTRAINT "CHK_attendance_status" CHECK ("status" IN ('PRESENT', 'ABSENT', 'LATE', 'EARLY_LEAVE')),
				CONSTRAINT "CHK_attendance_times" CHECK ("check_out_time" IS NULL OR ("check_in_time" IS NOT NULL AND "check_out_time" >= "check_in_time")),
				CONSTRAINT "CHK_attendance_absent_has_no_times" CHECK ("status" <> 'ABSENT' OR ("check_in_time" IS NULL AND "check_out_time" IS NULL))
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_attendance_date_child" ON "attendance" ("date", "child_id")`);
		await queryRunner.query(`
			ALTER TABLE "attendance"
				ADD CONSTRAINT "FK_attendance_child" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
				ADD CONSTRAINT "FK_attendance_recorded_by" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
		`);

		// ---- leave_requests -------------------------------------------------
		await queryRunner.query(`
			CREATE TABLE "leave_requests" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"child_id" uuid NOT NULL,
				"parent_user_id" uuid NOT NULL,
				"from_date" date NOT NULL,
				"to_date" date NOT NULL,
				"reason" character varying(1000) NOT NULL,
				"status" character varying(20) NOT NULL DEFAULT 'PENDING',
				"decided_by_user_id" uuid,
				"decided_at" TIMESTAMP WITH TIME ZONE,
				"decision_reason" character varying(500),
				"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				CONSTRAINT "PK_leave_requests" PRIMARY KEY ("id"),
				CONSTRAINT "CHK_leave_requests_dates" CHECK ("to_date" >= "from_date"),
				CONSTRAINT "CHK_leave_requests_status" CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
				CONSTRAINT "EXC_leave_requests_no_overlap" EXCLUDE USING gist ("child_id" WITH =, daterange("from_date", "to_date", '[]') WITH &&) WHERE ("status" IN ('PENDING', 'APPROVED'))
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_leave_requests_child_dates" ON "leave_requests" ("child_id", "from_date", "to_date")`);
		await queryRunner.query(`CREATE INDEX "IDX_leave_requests_status_created" ON "leave_requests" ("status", "created_at")`);
		await queryRunner.query(`
			ALTER TABLE "leave_requests"
				ADD CONSTRAINT "FK_leave_requests_child" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
				ADD CONSTRAINT "FK_leave_requests_parent" FOREIGN KEY ("parent_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
				ADD CONSTRAINT "FK_leave_requests_decided_by" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "leave_requests"`);
		await queryRunner.query(`DROP TABLE "attendance"`);
		// Không xóa extension: các bảng khác đang dùng pgcrypto.
	}
}
