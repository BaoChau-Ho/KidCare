import { Type } from "class-transformer";
import { IsOptional, Max, Min } from "class-validator";

export class ListChildActivitiesQueryDto {
	@IsOptional() @Type(() => Number) @Min(1) page = 1;
	@IsOptional() @Type(() => Number) @Min(1) @Max(100) limit = 10;
}
