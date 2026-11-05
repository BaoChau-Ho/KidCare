import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, Length, MaxLength } from "class-validator";

export class UpdateClassDto {
	@IsOptional()
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@Length(1, 100)
	name?: string;

	@IsOptional()
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@Length(4, 20)
	@MaxLength(20)
	academicYear?: string;

	@IsOptional()
	@IsIn(["ACTIVE", "CLOSED"])
	status?: "ACTIVE" | "CLOSED";
}
