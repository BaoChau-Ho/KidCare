import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from "class-validator";

export class AssignTeachersDto {
	@IsArray()
	@ArrayMinSize(1)
	@ArrayUnique()
	@IsUUID("4", { each: true })
	teacherUserIds!: string[];
}
