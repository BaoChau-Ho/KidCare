import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class ListClassesQueryDto {
	@IsOptional()
	@IsString()
	@MaxLength(20)
	academicYear?: string;

	@IsOptional()
	@IsIn(["ACTIVE", "CLOSED"])
	status?: "ACTIVE" | "CLOSED";

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page = 1;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit = 20;
}
