import {
	Body,
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { ChildrenService } from "./children.service";
import { CreateChildDto } from "./dto/create-child.dto";
import { LinkParentDto } from "./dto/link-parent.dto";
import { ListChildrenQueryDto } from "./dto/list-children-query.dto";
import { UpdateChildDto } from "./dto/update-child.dto";

@Controller("children")
@UseGuards(JwtAuthGuard)
export class ChildrenController {
	constructor(private readonly childrenService: ChildrenService) {}

	@Get()
	list(@Query() query: ListChildrenQueryDto, @Req() request: AuthenticatedRequest) {
		return this.childrenService.list(query, request.user);
	}

	@Post()
	create(@Body() dto: CreateChildDto, @Req() request: AuthenticatedRequest) {
		return this.childrenService.create(dto, request.user, request.ip ?? null);
	}

	@Get(":childId")
	getOne(@Param("childId", ParseUUIDPipe) childId: string, @Req() request: AuthenticatedRequest) {
		return this.childrenService.getOne(childId, request.user);
	}

	@Patch(":childId")
	update(
		@Param("childId", ParseUUIDPipe) childId: string,
		@Body() dto: UpdateChildDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.childrenService.update(childId, dto, request.user, request.ip ?? null);
	}

	@Post(":childId/parents")
	linkParent(
		@Param("childId", ParseUUIDPipe) childId: string,
		@Body() dto: LinkParentDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.childrenService.linkParent(childId, dto, request.user, request.ip ?? null);
	}
}
