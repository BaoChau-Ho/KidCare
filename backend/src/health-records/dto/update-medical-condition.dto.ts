import { Transform } from "class-transformer";
import {
	IsBoolean,
	IsOptional,
	IsString,
	MaxLength,
	ValidateIf,
} from "class-validator";

export class UpdateMedicalConditionDto {
	@IsOptional()
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MaxLength(2000)
	note?: string | null;

	@ValidateIf((_object, value) => value !== undefined)
	@IsBoolean()
	active?: boolean;
}
