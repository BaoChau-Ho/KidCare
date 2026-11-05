import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChildren1793810000005 implements MigrationInterface {
	name = "AddChildren1793810000005";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "children" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"name" character varying(150) NOT NULL,
				"date_of_birth" date NOT NULL,
				"gender" character varying(10) NOT NULL,
				"address" character varying(500),
				"avatar_url" character varying(2048),
				"class_id" uuid NOT NULL,
				"status" character varying(20) NOT NULL DEFAULT 'ACTIVE',
				"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				CONSTRAINT "PK_children_id" PRIMARY KEY ("id"),
				CONSTRAINT "CHK_children_gender" CHECK ("gender" IN ('MALE', 'FEMALE', 'OTHER')),
				CONSTRAINT "CHK_children_status" CHECK ("status" IN ('ACTIVE', 'INACTIVE', 'WITHDRAWN')),
				CONSTRAINT "FK_children_class" FOREIGN KEY ("class_id")
					REFERENCES "classes"("id") ON DELETE RESTRICT
			)
		`);
		await queryRunner.query(`
			CREATE TABLE "child_parents" (
				"child_id" uuid NOT NULL,
				"parent_user_id" uuid NOT NULL,
				"relationship" character varying(20) NOT NULL,
				"linked_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				CONSTRAINT "PK_child_parents" PRIMARY KEY ("child_id", "parent_user_id"),
				CONSTRAINT "CHK_child_parents_relationship" CHECK ("relationship" IN ('FATHER', 'MOTHER', 'GUARDIAN')),
				CONSTRAINT "FK_child_parents_child" FOREIGN KEY ("child_id")
					REFERENCES "children"("id") ON DELETE CASCADE,
				CONSTRAINT "FK_child_parents_parent" FOREIGN KEY ("parent_user_id")
					REFERENCES "users"("id") ON DELETE RESTRICT
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_children_class_status" ON "children" ("class_id", "status")`);
		await queryRunner.query(`CREATE INDEX "IDX_child_parents_parent" ON "child_parents" ("parent_user_id")`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "public"."IDX_child_parents_parent"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_children_class_status"`);
		await queryRunner.query(`DROP TABLE "child_parents"`);
		await queryRunner.query(`DROP TABLE "children"`);
	}
}
