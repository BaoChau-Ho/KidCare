import { MigrationInterface, QueryRunner } from "typeorm";

export class Stage5ActivitiesAndPickups1795305600000 implements MigrationInterface {
	name = "Stage5ActivitiesAndPickups1795305600000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "activities" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"class_id" uuid NOT NULL,
				"created_by_teacher_user_id" uuid NOT NULL,
				"title" character varying(200) NOT NULL,
				"description" character varying(5000),
				"date" date NOT NULL,
				"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				CONSTRAINT "PK_activities" PRIMARY KEY ("id"),
				CONSTRAINT "FK_activities_class" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_activities_teacher" FOREIGN KEY ("created_by_teacher_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_activities_class_date" ON "activities" ("class_id", "date" DESC)`);
		await queryRunner.query(`
			CREATE TABLE "activity_participants" (
				"activity_id" uuid NOT NULL,
				"child_id" uuid NOT NULL,
				"participation_status" character varying(20) NOT NULL,
				CONSTRAINT "PK_activity_participants" PRIMARY KEY ("activity_id", "child_id"),
				CONSTRAINT "CHK_activity_participants_status" CHECK ("participation_status" IN ('JOINED', 'NOT_JOINED')),
				CONSTRAINT "FK_activity_participants_activity" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE,
				CONSTRAINT "FK_activity_participants_child" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_activity_participants_child_status" ON "activity_participants" ("child_id", "participation_status")`);
		await queryRunner.query(`
			CREATE TABLE "activity_images" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"activity_id" uuid NOT NULL,
				"object_key" character varying(500) NOT NULL,
				"mime_type" character varying(30) NOT NULL,
				"original_name" character varying(255),
				"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				CONSTRAINT "PK_activity_images" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_activity_images_object_key" UNIQUE ("object_key"),
				CONSTRAINT "FK_activity_images_activity" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_activity_images_activity_created" ON "activity_images" ("activity_id", "created_at")`);
		await queryRunner.query(`
			CREATE TABLE "pickup_requests" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"child_id" uuid NOT NULL,
				"requester_user_id" uuid NOT NULL,
				"pickup_person" character varying(150) NOT NULL,
				"relationship" character varying(50) NOT NULL,
				"id_number" character varying(12) NOT NULL,
				"phone" character varying(20),
				"expected_time" TIMESTAMP WITH TIME ZONE NOT NULL,
				"status" character varying(20) NOT NULL DEFAULT 'PENDING',
				"verified_by_teacher_user_id" uuid,
				"decision_reason" character varying(500),
				"decided_at" TIMESTAMP WITH TIME ZONE,
				"completed_at" TIMESTAMP WITH TIME ZONE,
				"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				CONSTRAINT "PK_pickup_requests" PRIMARY KEY ("id"),
				CONSTRAINT "CHK_pickup_requests_status" CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED')),
				CONSTRAINT "CHK_pickup_requests_id_number" CHECK ("id_number" ~ '^([0-9]{9}|[0-9]{12})$'),
				CONSTRAINT "FK_pickup_requests_child" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_pickup_requests_requester" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_pickup_requests_verifier" FOREIGN KEY ("verified_by_teacher_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_pickup_requests_child_expected" ON "pickup_requests" ("child_id", "expected_time")`);
		await queryRunner.query(`CREATE INDEX "IDX_pickup_requests_status_expected" ON "pickup_requests" ("status", "expected_time")`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "pickup_requests"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_activity_images_activity_created"`);
		await queryRunner.query(`DROP TABLE "activity_images"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_activity_participants_child_status"`);
		await queryRunner.query(`DROP TABLE "activity_participants"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_activities_class_date"`);
		await queryRunner.query(`DROP TABLE "activities"`);
	}
}
