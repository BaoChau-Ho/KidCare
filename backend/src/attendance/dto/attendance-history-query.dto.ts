import { Type } from "class-transformer";
import { IsInt, IsOptional, Matches, Max, Min } from "class-validator";

export class AttendanceHistoryQueryDto {
	@IsOptional()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	from?: string;

	@IsOptional()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	to?: string;

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
