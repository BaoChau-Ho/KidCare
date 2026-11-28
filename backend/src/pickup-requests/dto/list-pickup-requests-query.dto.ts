import { Type } from "class-transformer";
import { IsDateString, IsIn, IsOptional, IsUUID, Max, Min } from "class-validator";
import type { PickupStatus } from "../pickup-request.entity";

export class ListPickupRequestsQueryDto {
	@IsOptional() @IsUUID() classId?: string;
	@IsOptional() @IsDateString({ strict: true }) date?: string;
	@IsOptional() @IsIn(["PENDING", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"]) status?: PickupStatus;
	@IsOptional() @Type(() => Number) @Min(1) page = 1;
	@IsOptional() @Type(() => Number) @Min(1) @Max(100) limit = 10;
}
