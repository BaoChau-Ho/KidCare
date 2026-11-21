import { Transform } from "class-transformer";
import {
	IsNumber,
	IsString,
	Max,
	MaxLength,
	Min,
	ValidateIf,
} from "class-validator";

export class CreateHealthRecordDto {
	@ValidateIf((_object, value) => value !== undefined)
	@IsNumber({ allowNaN: false, allowInfinity: false })
	@Min(30)
	@Max(150)
	height?: number;

	@ValidateIf((_object, value) => value !== undefined)
	@IsNumber({ allowNaN: false, allowInfinity: false })
	@Min(2)
	@Max(50)
	weight?: number;

	@ValidateIf((_object, value) => value !== undefined)
	@IsNumber({ allowNaN: false, allowInfinity: false })
	@Min(34)
	@Max(42)
	temperature?: number;

	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MaxLength(2000)
	note?: string;
}
