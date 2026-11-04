import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRegistrationRejectionReason1793757988356 implements MigrationInterface {
    name = 'AddRegistrationRejectionReason1793757988356'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "registration_requests" ADD "rejection_reason" character varying(500)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "registration_requests" DROP COLUMN "rejection_reason"`);
    }

}
