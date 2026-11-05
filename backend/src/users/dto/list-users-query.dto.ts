import { Transform, Type } from "class-transformer";
import {
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from "class-validator";
import type { UserRole, UserStatus } from "../user.entity";

const USER_ROLES: UserRole[] = [
	"ADMIN",
	"MANAGER",
	"TEACHER",
	"MEDICAL_STAFF",
	"PARENT",
];

const USER_STATUSES: UserStatus[] = ["ACTIVE", "LOCKED", "INACTIVE"];

export class ListUsersQueryDto {
	@IsOptional()
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MaxLength(100)
	query?: string;

	@IsOptional()
	@IsIn(USER_ROLES)
	role?: UserRole;

	@IsOptional()
	@IsIn(USER_STATUSES)
	status?: UserStatus;

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
