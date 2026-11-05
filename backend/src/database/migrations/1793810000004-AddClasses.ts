import { MigrationInterface, QueryRunner } from "typeorm";

export class AddClasses1793810000004 implements MigrationInterface {
	name = "AddClasses1793810000004";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "classes" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"name" character varying(100) NOT NULL,
				"academic_year" character varying(20) NOT NULL,
				"status" character varying(20) NOT NULL DEFAULT 'ACTIVE',
				"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				CONSTRAINT "PK_classes_id" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_classes_name_academic_year" UNIQUE ("name", "academic_year"),
				CONSTRAINT "CHK_classes_status" CHECK ("status" IN ('ACTIVE', 'CLOSED'))
			)
		`);
		await queryRunner.query(`
			CREATE TABLE "class_teachers" (
				"class_id" uuid NOT NULL,
				"teacher_user_id" uuid NOT NULL,
				"assigned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				CONSTRAINT "PK_class_teachers" PRIMARY KEY ("class_id", "teacher_user_id"),
				CONSTRAINT "FK_class_teachers_class" FOREIGN KEY ("class_id")
					REFERENCES "classes"("id") ON DELETE CASCADE,
				CONSTRAINT "FK_class_teachers_user" FOREIGN KEY ("teacher_user_id")
					REFERENCES "users"("id") ON DELETE RESTRICT
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_classes_year_status" ON "classes" ("academic_year", "status")`);
		await queryRunner.query(`CREATE INDEX "IDX_class_teachers_teacher" ON "class_teachers" ("teacher_user_id")`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "public"."IDX_class_teachers_teacher"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_classes_year_status"`);
		await queryRunner.query(`DROP TABLE "class_teachers"`);
		await queryRunner.query(`DROP TABLE "classes"`);
	}
}
