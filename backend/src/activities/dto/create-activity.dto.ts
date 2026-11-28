import { Type } from "class-transformer";
import { Transform } from "class-transformer";
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID, Length, ValidateNested } from "class-validator";

export class ActivityParticipantInputDto {
	@IsUUID() childId!: string;
	@IsIn(["JOINED", "NOT_JOINED"]) participationStatus!: "JOINED" | "NOT_JOINED";
}

export class CreateActivityDto {
	@IsUUID() classId!: string;
	@Transform(({ value }) => typeof value === "string" ? value.trim() : value)
	@IsString() @Length(1, 200) title!: string;
	@IsOptional() @IsString() @Length(0, 5000) description?: string;
	@IsDateString({ strict: true }) date!: string;
	@IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ActivityParticipantInputDto)
	participants?: ActivityParticipantInputDto[];
}
