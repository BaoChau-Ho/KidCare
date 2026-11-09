import { Transform } from "class-transformer";
import { IsString, IsUUID, Length, Matches } from "class-validator";

export class CreateLeaveRequestDto {
	@IsUUID("4")
	childId!: string;

	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	fromDate!: string;

	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	toDate!: string;

	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@Length(1, 1000)
	reason!: string;
}
