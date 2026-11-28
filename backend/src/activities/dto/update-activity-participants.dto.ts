import { Type } from "class-transformer";
import { ArrayMinSize, ArrayMaxSize, IsArray, ValidateNested } from "class-validator";
import { ActivityParticipantInputDto } from "./create-activity.dto";

export class UpdateActivityParticipantsDto {
	@IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ActivityParticipantInputDto)
	participants!: ActivityParticipantInputDto[];
}
