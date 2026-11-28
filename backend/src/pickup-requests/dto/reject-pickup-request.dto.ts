import { Transform } from "class-transformer";
import { IsString, Length } from "class-validator";

export class RejectPickupRequestDto {
	@Transform(({ value }) => typeof value === "string" ? value.trim() : value)
	@IsString() @Length(1, 500) reason!: string;
}
