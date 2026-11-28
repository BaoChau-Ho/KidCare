import { Transform, Type } from "class-transformer";
import {
	IsDateString,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
} from "class-validator";

export class ListAuditLogsQueryDto {
	@IsOptional()
	@IsUUID()
	actorUserId?: string;

	@IsOptional()
	@Transform(({ value }) =>
		typeof value === "string" ? value.trim() : value,
	)
	@IsString()
	@MaxLength(100)
	action?: string;

	@IsOptional()
	@Transform(({ value }) =>
		typeof value === "string" ? value.trim() : value,
	)
	@IsString()
	@MaxLength(100)
	resourceType?: string;

	@IsOptional()
	@IsUUID()
	resourceId?: string;

	@IsDateString({ strict: true })
	from!: string;

	@IsDateString({ strict: true })
	to!: string;

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