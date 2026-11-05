import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeRegistrationRequestIdToUuid1793810000001
  implements MigrationInterface
{
  name = 'ChangeRegistrationRequestIdToUuid1793810000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "registration_requests" ALTER COLUMN "id" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "registration_requests" DROP CONSTRAINT "PK_75e49f863f30250e82ab8638eaa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registration_requests" ALTER COLUMN "id" TYPE uuid USING gen_random_uuid()`,
    );
    await queryRunner.query(
      `ALTER TABLE "registration_requests" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()`,
    );
    await queryRunner.query(
      `ALTER TABLE "registration_requests" ADD CONSTRAINT "PK_75e49f863f30250e82ab8638eaa" PRIMARY KEY ("id")`,
    );
    await queryRunner.query(
      `DROP SEQUENCE IF EXISTS "registration_requests_id_seq"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "registration_requests" DROP CONSTRAINT "PK_75e49f863f30250e82ab8638eaa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registration_requests" ADD COLUMN "integer_id" SERIAL NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "registration_requests" DROP COLUMN "id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registration_requests" RENAME COLUMN "integer_id" TO "id"`,
    );
    await queryRunner.query(
      `ALTER SEQUENCE "registration_requests_integer_id_seq" RENAME TO "registration_requests_id_seq"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registration_requests" ADD CONSTRAINT "PK_75e49f863f30250e82ab8638eaa" PRIMARY KEY ("id")`,
    );
  }
}
