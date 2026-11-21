import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMedicalVisitsAndMedications1794268800004 implements MigrationInterface {
	name = "AddMedicalVisitsAndMedications1794268800004";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "medical_visits" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"child_id" uuid NOT NULL,
				"recorded_by_staff_user_id" uuid NOT NULL,
				"visited_at" TIMESTAMP WITH TIME ZONE NOT NULL,
				"symptoms" character varying(2000),
				"conclusion" character varying(2000),
				"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				CONSTRAINT "PK_medical_visits" PRIMARY KEY ("id"),
				CONSTRAINT "CHK_medical_visits_has_details" CHECK ("symptoms" IS NOT NULL OR "conclusion" IS NOT NULL),
				CONSTRAINT "FK_medical_visits_child" FOREIGN KEY ("child_id")
					REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
				CONSTRAINT "FK_medical_visits_recorded_by_staff" FOREIGN KEY ("recorded_by_staff_user_id")
					REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_medical_visits_child_visited_at" ON "medical_visits" ("child_id", "visited_at")`,
		);
		await queryRunner.query(`
			CREATE TABLE "medications" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"medical_visit_id" uuid NOT NULL,
				"name" character varying(200) NOT NULL,
				"dosage" character varying(200) NOT NULL,
				"schedule" character varying(200) NOT NULL,
				CONSTRAINT "PK_medications" PRIMARY KEY ("id"),
				CONSTRAINT "FK_medications_medical_visit" FOREIGN KEY ("medical_visit_id")
					REFERENCES "medical_visits"("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_medications_medical_visit" ON "medications" ("medical_visit_id")`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "public"."IDX_medications_medical_visit"`);
		await queryRunner.query(`DROP TABLE "medications"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_medical_visits_child_visited_at"`);
		await queryRunner.query(`DROP TABLE "medical_visits"`);
	}
}
