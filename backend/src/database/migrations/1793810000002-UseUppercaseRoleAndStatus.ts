import { MigrationInterface, QueryRunner } from 'typeorm';

export class UseUppercaseRoleAndStatus1793810000002
  implements MigrationInterface
{
  name = 'UseUppercaseRoleAndStatus1793810000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "users"
      SET "role" = CASE LOWER("role")
        WHEN 'parent' THEN 'PARENT'
        WHEN 'teacher' THEN 'TEACHER'
        WHEN 'medical' THEN 'MEDICAL_STAFF'
        WHEN 'medical_staff' THEN 'MEDICAL_STAFF'
        WHEN 'manager' THEN 'MANAGER'
        WHEN 'admin' THEN 'ADMIN'
        ELSE UPPER("role")
      END,
      "status" = CASE LOWER("status")
        WHEN 'active' THEN 'ACTIVE'
        WHEN 'locked' THEN 'LOCKED'
        WHEN 'disabled' THEN 'LOCKED'
        WHEN 'pending' THEN 'INACTIVE'
        WHEN 'inactive' THEN 'INACTIVE'
        ELSE UPPER("status")
      END
    `);
    await queryRunner.query(`
      UPDATE "registration_requests"
      SET "role" = CASE LOWER("role")
        WHEN 'parent' THEN 'PARENT'
        WHEN 'teacher' THEN 'TEACHER'
        WHEN 'medical' THEN 'MEDICAL_STAFF'
        WHEN 'medical_staff' THEN 'MEDICAL_STAFF'
        WHEN 'manager' THEN 'MANAGER'
        WHEN 'admin' THEN 'ADMIN'
        ELSE UPPER("role")
      END,
      "status" = UPPER("status")
    `);
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'PARENT'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'`,
    );
    await queryRunner.query(
      `ALTER TABLE "registration_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "users"
      SET "role" = CASE "role"
        WHEN 'PARENT' THEN 'parent'
        WHEN 'TEACHER' THEN 'teacher'
        WHEN 'MEDICAL_STAFF' THEN 'medical'
        WHEN 'MANAGER' THEN 'manager'
        WHEN 'ADMIN' THEN 'admin'
        ELSE LOWER("role")
      END,
      "status" = CASE "status"
        WHEN 'ACTIVE' THEN 'active'
        WHEN 'LOCKED' THEN 'disabled'
        WHEN 'INACTIVE' THEN 'pending'
        ELSE LOWER("status")
      END
    `);
    await queryRunner.query(`
      UPDATE "registration_requests"
      SET "role" = CASE "role"
        WHEN 'PARENT' THEN 'parent'
        WHEN 'TEACHER' THEN 'teacher'
        WHEN 'MEDICAL_STAFF' THEN 'medical'
        WHEN 'MANAGER' THEN 'manager'
        WHEN 'ADMIN' THEN 'admin'
        ELSE LOWER("role")
      END,
      "status" = LOWER("status")
    `);
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'parent'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active'`,
    );
    await queryRunner.query(
      `ALTER TABLE "registration_requests" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
  }
}
