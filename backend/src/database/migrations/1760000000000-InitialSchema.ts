import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1760000000000 implements MigrationInterface {
  name = 'InitialSchema1760000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT 1');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT 1');
  }
}
