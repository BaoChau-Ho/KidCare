import { Transform } from "class-transformer";
import {
	IsIn,
	IsString,
	Length,
	MaxLength,
	ValidateIf,
} from "class-validator";

export class CreateAllergyDto {
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@Length(1, 200)
	allergen!: string;

	@IsIn(["MILD", "MODERATE", "SEVERE"])
	severity!: "MILD" | "MODERATE" | "SEVERE";

	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MaxLength(2000)
	note?: string;
}
