import { IsIn } from "class-validator";
import type { UserRole } from "../user.entity";

const USER_ROLES: UserRole[] = [
	"ADMIN",
	"MANAGER",
	"TEACHER",
	"MEDICAL_STAFF",
	"PARENT",
];

export class ChangeUserRoleDto {
	@IsIn(USER_ROLES)
	role!: UserRole;
}