import { Transform } from 'class-transformer';
import {
	IsOptional,
	IsString,
	Length,
	MaxLength,
} from 'class-validator';

export class UpdateUserDto {
	@IsOptional()
	@Transform(({ value }) =>
		typeof value === 'string' ? value.trim() : value,
	)
	@IsString()
	@Length(1, 100)
	fullName?: string;

	@IsOptional()
	@Transform(({ value }) =>
		typeof value === 'string' ? value.trim() : value,
	)
	@IsString()
	@MaxLength(20)
	phone?: string | null;
}