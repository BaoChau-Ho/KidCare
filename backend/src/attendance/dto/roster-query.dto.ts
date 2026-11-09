import { IsOptional, Matches } from "class-validator";

export class RosterQueryDto {
	// Mặc định là hôm nay (giờ của trường).
	@IsOptional()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	date?: string;
}
