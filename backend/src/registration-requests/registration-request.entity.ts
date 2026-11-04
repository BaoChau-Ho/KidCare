import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('registration_requests')
export class RegistrationRequest {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'full_name', type: 'varchar', length: 100 })
  fullName!: string;

  @Column({ type: 'varchar', length: 254 })
  email!: string;

  @Column({ type: 'varchar', length: 20 })
  phone!: string;

  @Column({ type: 'varchar', length: 30 })
  role!: string;

  @Column({ name: 'national_id', type: 'varchar', length: 12 })
  nationalId!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({
    name: 'rejection_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  rejectionReason!: string | null;
  @Column({
    name: 'password_setup_token_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  passwordSetupTokenHash!: string | null;

  @Column({
    name: 'password_setup_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  passwordSetupExpiresAt!: Date | null;
}