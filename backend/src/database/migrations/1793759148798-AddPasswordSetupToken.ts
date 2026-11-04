import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPasswordSetupToken1793759148798 implements MigrationInterface {
    name = 'AddPasswordSetupToken1793759148798'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "registration_requests" ADD "password_setup_token_hash" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "registration_requests" ADD "password_setup_expires_at" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "registration_requests" DROP COLUMN "password_setup_expires_at"`);
        await queryRunner.query(`ALTER TABLE "registration_requests" DROP COLUMN "password_setup_token_hash"`);
    }

}
