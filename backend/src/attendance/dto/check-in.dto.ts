import { IsIn, IsISO8601, IsOptional, IsUUID, Matches } from "class-validator";

export class CheckInDto {
	@IsUUID("4")
	childId!: string;

	// Mặc định là hôm nay; không được ở tương lai.
	@IsOptional()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	date?: string;

	// ISO 8601 có múi giờ, ví dụ 2026-11-04T08:05:00+07:00. Mặc định là hiện tại khi date là hôm nay.
	@IsOptional()
	@IsISO8601({ strict: true })
	checkInTime?: string;

	// Chỉ dùng để ghi vắng (không có giờ đến). Bỏ trống để check-in bình thường.
	@IsOptional()
	@IsIn(["ABSENT"])
	status?: "ABSENT";
}
