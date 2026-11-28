import { Transform } from "class-transformer";
import { IsDateString, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from "class-validator";

export class CreatePickupRequestDto {
	@IsUUID() childId!: string;
	@Transform(({ value }) => typeof value === "string" ? value.trim() : value)
	@IsString() @Length(1, 150) pickupPerson!: string;
	@Transform(({ value }) => typeof value === "string" ? value.trim() : value)
	@IsString() @Length(1, 50) relationship!: string;
	@Transform(({ value }) => typeof value === "string" ? value.trim() : value)
	@IsString() @Matches(/^(\d{9}|\d{12})$/) idNumber!: string;
	@Transform(({ value }) => typeof value === "string" ? value.replace(/\s/g, "") : value)
	@IsOptional() @IsString() @MaxLength(30) @Matches(/^\+?\d{9,12}$/) phone?: string;
	@IsDateString() expectedTime!: string;
}
