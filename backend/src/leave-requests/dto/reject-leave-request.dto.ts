import { Transform } from "class-transformer";
import { IsString, Length } from "class-validator";

export class RejectLeaveRequestDto {
	// Bắt buộc: lý do được gửi cho phụ huynh.
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@Length(1, 500)
	reason!: string;
}
