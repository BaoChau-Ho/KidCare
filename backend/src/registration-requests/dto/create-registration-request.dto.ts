import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import type { RegistrationRequestRole } from '../registration-request.entity';

const REGISTER_ROLES: RegistrationRequestRole[] = [
  'PARENT',
  'TEACHER',
  'MEDICAL_STAFF',
  'MANAGER',
];

export class CreateRegistrationRequestDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 100)
  fullName!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\s/g, '') : value,
  )
  @IsString()
  @Matches(/^\+?\d{9,12}$/)
  phone!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsIn(REGISTER_ROLES)
  role!: RegistrationRequestRole;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/^\d{12}$/)
  nationalId!: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Mật khẩu cần có chữ thường, chữ hoa, số và ký tự đặc biệt.',
  })
  password!: string;
}
