import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeUserIdToUuid1793810000000 implements MigrationInterface {
  name = 'ChangeUserIdToUuid1793810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "id" TYPE uuid USING gen_random_uuid()`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")`,
    );
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "users_id_seq"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "integer_id" SERIAL NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "id"`);
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "integer_id" TO "id"`,
    );
    await queryRunner.query(
      `ALTER SEQUENCE "users_integer_id_seq" RENAME TO "users_id_seq"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")`,
    );
  }
}
