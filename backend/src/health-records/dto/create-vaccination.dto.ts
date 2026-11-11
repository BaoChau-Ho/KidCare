import { Transform } from "class-transformer";
import {
	IsInt,
	IsString,
	Length,
	Matches,
	Max,
	Min,
	ValidateIf,
} from "class-validator";

export class CreateVaccinationDto {
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@Matches(/\S/)
	@Length(1, 200)
	vaccineName!: string;

	@IsInt()
	@Min(1)
	@Max(10)
	doseNumber!: number;

	@IsString()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	vaccinatedAt!: string;

	@ValidateIf((_object, value) => value !== undefined)
	@IsString()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	nextDueDate?: string;
}
