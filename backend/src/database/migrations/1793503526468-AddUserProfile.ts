import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserProfile1793503526468 implements MigrationInterface {
    name = 'AddUserProfile1793503526468'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "full_name" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "role" character varying(20) NOT NULL DEFAULT 'parent'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "status" character varying(20) NOT NULL DEFAULT 'active'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "phone" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "national_id" character varying(12)`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_232b9597ff9a89b2c2fc5d1b5e5" UNIQUE ("national_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_232b9597ff9a89b2c2fc5d1b5e5"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "national_id"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "status"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "full_name"`);
    }

}
