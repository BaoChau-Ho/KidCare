import { IsIn, IsISO8601, IsOptional } from "class-validator";

export class UpdateAttendanceDto {
	@IsOptional()
	@IsIn(["PRESENT", "ABSENT", "LATE", "EARLY_LEAVE"])
	status?: "PRESENT" | "ABSENT" | "LATE" | "EARLY_LEAVE";

	// null nghĩa là xóa giờ; không gửi nghĩa là giữ nguyên.
	@IsOptional()
	@IsISO8601({ strict: true })
	checkInTime?: string | null;

	@IsOptional()
	@IsISO8601({ strict: true })
	checkOutTime?: string | null;
}
