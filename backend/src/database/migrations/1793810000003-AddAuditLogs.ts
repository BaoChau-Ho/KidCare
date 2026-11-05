import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditLogs1793810000003 implements MigrationInterface {
	name = "AddAuditLogs1793810000003";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "actor_user_id" uuid, "actor_name" character varying(100), "action" character varying(100) NOT NULL, "resource_type" character varying(100) NOT NULL, "resource_id" uuid NOT NULL, "old_value" jsonb, "new_value" jsonb, "ip_address" character varying(45), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_audit_logs_resource" ON "audit_logs" ("resource_type", "resource_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_audit_logs_actor_created" ON "audit_logs" ("actor_user_id", "created_at") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_actor_created"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_resource"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
    }

}
