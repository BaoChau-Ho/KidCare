import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotifications1794355200000 implements MigrationInterface {
	name = "AddNotifications1794355200000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "notifications" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"recipient_user_id" uuid NOT NULL,
				"sender_user_id" uuid,
				"type" character varying(30) NOT NULL,
				"title" character varying(200) NOT NULL,
				"content" character varying(5000) NOT NULL,
				"related_type" character varying(50),
				"related_id" uuid,
				"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"read_at" TIMESTAMP WITH TIME ZONE,
				CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
				CONSTRAINT "FK_notifications_recipient" FOREIGN KEY ("recipient_user_id")
					REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_notifications_sender" FOREIGN KEY ("sender_user_id")
					REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_notifications_recipient_created" ON "notifications" ("recipient_user_id", "created_at" DESC, "id" DESC)`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_notifications_recipient_unread" ON "notifications" ("recipient_user_id", "read_at") WHERE "read_at" IS NULL`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "public"."IDX_notifications_recipient_unread"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_notifications_recipient_created"`);
		await queryRunner.query(`DROP TABLE "notifications"`);
	}
}
