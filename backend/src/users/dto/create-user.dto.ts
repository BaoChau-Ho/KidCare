import { Transform } from "class-transformer";
import {
	IsEmail,
	IsIn,
	IsOptional,
	IsString,
	Length,
	MaxLength,
} from "class-validator";
import type { UserRole } from "../user.entity";

const USER_ROLES: UserRole[] = [
	"ADMIN",
	"MANAGER",
	"TEACHER",
	"MEDICAL_STAFF",
	"PARENT",
];

export class CreateUserDto {
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@Length(1, 100)
	fullName!: string;

	@Transform(({ value }) =>
		typeof value === "string" ? value.trim().toLowerCase() : value,
	)
	@IsEmail()
	@MaxLength(254)
	email!: string;

	@IsOptional()
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MaxLength(20)
	phone?: string;

	@IsString()
	@Length(8, 128)
	temporaryPassword!: string;

	@IsIn(USER_ROLES)
	role!: UserRole;
}
