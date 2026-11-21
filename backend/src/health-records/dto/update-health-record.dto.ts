import { Transform } from "class-transformer";
import {
	IsNumber,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from "class-validator";

export class UpdateHealthRecordDto {
	// Không gửi trường này nghĩa là giữ nguyên; null nghĩa là xóa chỉ số.
	@IsOptional()
	@IsNumber({ allowNaN: false, allowInfinity: false })
	@Min(30)
	@Max(150)
	height?: number | null;

	@IsOptional()
	@IsNumber({ allowNaN: false, allowInfinity: false })
	@Min(2)
	@Max(50)
	weight?: number | null;

	@IsOptional()
	@IsNumber({ allowNaN: false, allowInfinity: false })
	@Min(34)
	@Max(42)
	temperature?: number | null;

	// null nghĩa là xóa ghi chú; không gửi nghĩa là giữ nguyên.
	@IsOptional()
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MaxLength(2000)
	note?: string | null;
}
