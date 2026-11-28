import { Transform, Type } from "class-transformer";
import {
	IsDateString,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
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
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	from!: string;

	@IsDateString({ strict: true })
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
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
