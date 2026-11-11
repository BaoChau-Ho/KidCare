import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMedicalConditions1794268800002 implements MigrationInterface {
	name = "AddMedicalConditions1794268800002";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "medical_conditions" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"child_id" uuid NOT NULL,
				"name" character varying(200) NOT NULL,
				"note" character varying(2000),
				"active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				CONSTRAINT "PK_medical_conditions" PRIMARY KEY ("id"),
				CONSTRAINT "FK_medical_conditions_child" FOREIGN KEY ("child_id")
					REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_medical_conditions_child_active" ON "medical_conditions" ("child_id", "active")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_medical_conditions_child_created_at" ON "medical_conditions" ("child_id", "created_at")`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "public"."IDX_medical_conditions_child_created_at"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_medical_conditions_child_active"`);
		await queryRunner.query(`DROP TABLE "medical_conditions"`);
	}
}
