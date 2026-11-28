import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString, IsUUID, MaxLength } from "class-validator";

export class MarkRelatedNotificationsReadDto {
	@IsString()
	@MaxLength(50)
	relatedType!: string;

	@IsArray()
	@ArrayNotEmpty()
	@ArrayMaxSize(100)
	@IsUUID("all", { each: true })
	relatedIds!: string[];
}
