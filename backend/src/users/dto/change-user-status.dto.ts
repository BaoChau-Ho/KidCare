import { IsIn } from "class-validator";
import type { UserStatus } from "../user.entity";

const USER_STATUSES: UserStatus[] = [
	"ACTIVE",
	"LOCKED",
	"INACTIVE",
];

export class ChangeUserStatusDto {
	@IsIn(USER_STATUSES)
	status!: UserStatus;
}