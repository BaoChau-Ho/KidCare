import { Transform } from "class-transformer";
import { IsString, Length, MaxLength } from "class-validator";

export class CreateClassDto {
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@Length(1, 100)
	name!: string;

	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@Length(4, 20)
	@MaxLength(20)
	academicYear!: string;
}
