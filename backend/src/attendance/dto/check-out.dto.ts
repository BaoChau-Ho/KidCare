import { IsISO8601, IsOptional, IsUUID, Matches } from "class-validator";

export class CheckOutDto {
	@IsUUID("4")
	childId!: string;

	@IsOptional()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	date?: string;

	@IsOptional()
	@IsISO8601({ strict: true })
	checkOutTime?: string;
}
