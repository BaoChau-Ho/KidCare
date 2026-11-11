import { Transform, Type } from "class-transformer";
import {
	ArrayMaxSize,
	IsArray,
	IsISO8601,
	IsString,
	Length,
	MaxLength,
	ValidateIf,
	ValidateNested,
} from "class-validator";

export class MedicationInputDto {
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@Length(1, 200)
	name!: string;

	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@Length(1, 200)
	dosage!: string;

	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@Length(1, 200)
	schedule!: string;
}

export class CreateMedicalVisitDto {
	@ValidateIf((_object, value) => value !== undefined)
	@IsString()
	@IsISO8601({ strict: true })
	visitedAt?: string;

	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MaxLength(2000)
	symptoms?: string;

	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MaxLength(2000)
	conclusion?: string;

	@ValidateIf((_object, value) => value !== undefined)
	@IsArray()
	@ArrayMaxSize(20)
	@ValidateNested({ each: true })
	@Type(() => MedicationInputDto)
	medications?: MedicationInputDto[];
}
