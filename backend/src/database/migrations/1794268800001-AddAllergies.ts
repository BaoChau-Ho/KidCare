import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAllergies1794268800001 implements MigrationInterface {
	name = "AddAllergies1794268800001";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "allergies" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"child_id" uuid NOT NULL,
				"allergen" character varying(200) NOT NULL,
				"severity" character varying(20) NOT NULL,
				"note" character varying(2000),
				"active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				CONSTRAINT "PK_allergies" PRIMARY KEY ("id"),
				CONSTRAINT "CHK_allergies_severity" CHECK ("severity" IN ('MILD', 'MODERATE', 'SEVERE')),
				CONSTRAINT "FK_allergies_child" FOREIGN KEY ("child_id")
					REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_allergies_child_active" ON "allergies" ("child_id", "active")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_allergies_child_created_at" ON "allergies" ("child_id", "created_at")`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "public"."IDX_allergies_child_created_at"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_allergies_child_active"`);
		await queryRunner.query(`DROP TABLE "allergies"`);
	}
}
