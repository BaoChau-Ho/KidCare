import { CreateDateColumn, Entity, PrimaryColumn } from "typeorm";
import type { Relationship } from "./dto/link-parent.dto";
import { Column } from "typeorm";

@Entity("child_parents")
export class ChildParent {
	@PrimaryColumn({ name: "child_id", type: "uuid" })
	childId!: string;

	@PrimaryColumn({ name: "parent_user_id", type: "uuid" })
	parentUserId!: string;

	@Column({ type: "varchar", length: 20 })
	relationship!: Relationship;

	@CreateDateColumn({ name: "linked_at", type: "timestamptz" })
	linkedAt!: Date;
}
