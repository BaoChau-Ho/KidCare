import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class RejectRegistrationRequestDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(3, 500)
  reason!: string;
}