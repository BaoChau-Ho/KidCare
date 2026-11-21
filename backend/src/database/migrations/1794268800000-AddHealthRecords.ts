import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHealthRecords1794268800000 implements MigrationInterface {
	name = "AddHealthRecords1794268800000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
		await queryRunner.query(`
			CREATE TABLE "health_records" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"child_id" uuid NOT NULL,
				"recorded_by_staff_user_id" uuid NOT NULL,
				"height" double precision,
				"weight" double precision,
				"temperature" double precision,
				"note" character varying(2000),
				"recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				CONSTRAINT "PK_health_records" PRIMARY KEY ("id"),
				CONSTRAINT "FK_health_records_child" FOREIGN KEY ("child_id")
					REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
				CONSTRAINT "FK_health_records_recorded_by_staff" FOREIGN KEY ("recorded_by_staff_user_id")
					REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_health_records_child_recorded_at" ON "health_records" ("child_id", "recorded_at")`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "public"."IDX_health_records_child_recorded_at"`);
		await queryRunner.query(`DROP TABLE "health_records"`);
		// Không gỡ pgcrypto vì các bảng khác cũng dùng extension này.
	}
}
