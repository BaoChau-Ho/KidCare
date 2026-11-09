import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class ListLeaveRequestsQueryDto {
	@IsOptional()
	@IsIn(["PENDING", "APPROVED", "REJECTED", "CANCELLED"])
	status?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

	@IsOptional()
	@IsUUID("4")
	childId?: string;

	@IsOptional()
	@IsUUID("4")
	classId?: string;

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
