import { Transform } from "class-transformer";
import {
	IsBoolean,
	IsIn,
	IsOptional,
	IsString,
	MaxLength,
	ValidateIf,
} from "class-validator";

export class UpdateAllergyDto {
	@ValidateIf((_object, value) => value !== undefined)
	@IsIn(["MILD", "MODERATE", "SEVERE"])
	severity?: "MILD" | "MODERATE" | "SEVERE";

	@IsOptional()
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MaxLength(2000)
	note?: string | null;

	@ValidateIf((_object, value) => value !== undefined)
	@IsBoolean()
	active?: boolean;
}
