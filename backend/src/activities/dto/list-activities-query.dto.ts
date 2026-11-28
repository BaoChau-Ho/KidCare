import { Type } from "class-transformer";
import { IsDateString, IsOptional, IsUUID, Max, Min } from "class-validator";

export class ListActivitiesQueryDto {
	@IsOptional() @IsUUID() classId?: string;
	@IsOptional() @IsDateString({ strict: true }) date?: string;
	@IsOptional() @Type(() => Number) @Min(1) page = 1;
	@IsOptional() @Type(() => Number) @Min(1) @Max(100) limit = 10;
}
