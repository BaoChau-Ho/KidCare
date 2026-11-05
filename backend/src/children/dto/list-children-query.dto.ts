import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class ListChildrenQueryDto {
	@IsOptional()
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MaxLength(100)
	query?: string;

	@IsOptional()
	@IsUUID("4")
	classId?: string;

	@IsOptional()
	@IsIn(["ACTIVE", "INACTIVE", "WITHDRAWN"])
	status?: "ACTIVE" | "INACTIVE" | "WITHDRAWN";

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
