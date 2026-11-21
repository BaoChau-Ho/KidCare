import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVaccinations1794268800003 implements MigrationInterface {
	name = "AddVaccinations1794268800003";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "vaccinations" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"child_id" uuid NOT NULL,
				"vaccine_name" character varying(200) NOT NULL,
				"dose_number" integer NOT NULL,
				"vaccinated_at" date NOT NULL,
				"next_due_date" date,
				CONSTRAINT "PK_vaccinations" PRIMARY KEY ("id"),
				CONSTRAINT "CHK_vaccinations_dose_number" CHECK ("dose_number" BETWEEN 1 AND 10),
				CONSTRAINT "CHK_vaccinations_next_due_after_vaccinated" CHECK ("next_due_date" IS NULL OR "next_due_date" > "vaccinated_at"),
				CONSTRAINT "FK_vaccinations_child" FOREIGN KEY ("child_id")
					REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_vaccinations_child_vaccinated_at" ON "vaccinations" ("child_id", "vaccinated_at")`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "public"."IDX_vaccinations_child_vaccinated_at"`);
		await queryRunner.query(`DROP TABLE "vaccinations"`);
	}
}
