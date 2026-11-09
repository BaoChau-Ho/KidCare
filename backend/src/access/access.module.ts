import { Module } from "@nestjs/common";
import { ChildAccessService } from "./child-access.service";

@Module({
	providers: [ChildAccessService],
	exports: [ChildAccessService],
})
export class AccessModule {}
