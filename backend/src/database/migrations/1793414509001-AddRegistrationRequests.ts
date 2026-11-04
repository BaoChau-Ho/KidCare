import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRegistrationRequests1793414509001 implements MigrationInterface {
    name = 'AddRegistrationRequests1793414509001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "registration_requests" ("id" SERIAL NOT NULL, "full_name" character varying(100) NOT NULL, "email" character varying(254) NOT NULL, "phone" character varying(20) NOT NULL, "role" character varying(30) NOT NULL, "national_id" character varying(12) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_75e49f863f30250e82ab8638eaa" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "registration_requests"`);
    }

}
