import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
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
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { ListLeaveRequestsQueryDto } from "./dto/list-leave-requests-query.dto";
import { RejectLeaveRequestDto } from "./dto/reject-leave-request.dto";
import { LeaveRequestsService } from "./leave-requests.service";

@Controller("leave-requests")
@UseGuards(JwtAuthGuard)
export class LeaveRequestsController {
	constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

	@Post()
	create(@Body() dto: CreateLeaveRequestDto, @Req() request: AuthenticatedRequest) {
		return this.leaveRequestsService.create(dto, request.user, request.ip ?? null);
	}

	@Get()
	list(@Query() query: ListLeaveRequestsQueryDto, @Req() request: AuthenticatedRequest) {
		return this.leaveRequestsService.list(query, request.user);
	}

	@Post(":requestId/approve")
	@HttpCode(HttpStatus.OK)
	approve(@Param("requestId", ParseUUIDPipe) requestId: string, @Req() request: AuthenticatedRequest) {
		return this.leaveRequestsService.approve(requestId, request.user, request.ip ?? null);
	}

	@Post(":requestId/reject")
	@HttpCode(HttpStatus.OK)
	reject(
		@Param("requestId", ParseUUIDPipe) requestId: string,
		@Body() dto: RejectLeaveRequestDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.leaveRequestsService.reject(requestId, dto.reason, request.user, request.ip ?? null);
	}

	@Patch(":requestId/cancel")
	cancel(@Param("requestId", ParseUUIDPipe) requestId: string, @Req() request: AuthenticatedRequest) {
		return this.leaveRequestsService.cancel(requestId, request.user, request.ip ?? null);
	}
}
