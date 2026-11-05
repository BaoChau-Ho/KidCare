import { IsIn, IsUUID } from "class-validator";

export type Relationship = "FATHER" | "MOTHER" | "GUARDIAN";

export class LinkParentDto {
	@IsUUID("4")
	parentUserId!: string;

	@IsIn(["FATHER", "MOTHER", "GUARDIAN"])
	relationship!: Relationship;
}
