import { Transform } from "class-transformer";
import { IsString, Length, MaxLength, ValidateIf } from "class-validator";

export class CreateMedicalConditionDto {
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@Length(1, 200)
	name!: string;

	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MaxLength(2000)
	note?: string;
}
