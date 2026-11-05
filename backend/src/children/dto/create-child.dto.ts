import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, IsUrl, IsUUID, Length, Matches, MaxLength } from "class-validator";

export class CreateChildDto {
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@Length(1, 150)
	name!: string;

	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	dateOfBirth!: string;

	@IsIn(["MALE", "FEMALE", "OTHER"])
	gender!: "MALE" | "FEMALE" | "OTHER";

	@IsOptional()
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MaxLength(500)
	address?: string;

	@IsOptional()
	@IsUrl({ require_protocol: true })
	@MaxLength(2048)
	avatarUrl?: string;

	@IsUUID("4")
	classId!: string;
}
