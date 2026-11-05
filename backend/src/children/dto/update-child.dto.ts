import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, IsUrl, IsUUID, Matches, MaxLength } from "class-validator";

export class UpdateChildDto {
	@IsOptional()
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MaxLength(150)
	name?: string;

	@IsOptional()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	dateOfBirth?: string;

	@IsOptional()
	@IsIn(["MALE", "FEMALE", "OTHER"])
	gender?: "MALE" | "FEMALE" | "OTHER";

	@IsOptional()
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MaxLength(500)
	address?: string | null;

	@IsOptional()
	@IsUrl({ require_protocol: true })
	@MaxLength(2048)
	avatarUrl?: string | null;

	@IsOptional()
	@IsUUID("4")
	classId?: string;

	@IsOptional()
	@IsIn(["ACTIVE", "INACTIVE", "WITHDRAWN"])
	status?: "ACTIVE" | "INACTIVE" | "WITHDRAWN";
}
