import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { CreatePickupRequestDto } from "./dto/create-pickup-request.dto";
import { ListPickupRequestsQueryDto } from "./dto/list-pickup-requests-query.dto";
import { RejectPickupRequestDto } from "./dto/reject-pickup-request.dto";
import { PickupRequestsService } from "./pickup-requests.service";

@Controller("pickup-requests")
@UseGuards(JwtAuthGuard)
export class PickupRequestsController {
	constructor(private readonly pickups: PickupRequestsService) {}

	@Get() list(@Query() query: ListPickupRequestsQueryDto, @Req() req: AuthenticatedRequest) { return this.pickups.list(query, req.user); }
	@Post() create(@Body() dto: CreatePickupRequestDto, @Req() req: AuthenticatedRequest) { return this.pickups.create(dto, req.user, req.ip ?? null); }
	@Patch(":requestId/cancel") cancel(@Param("requestId", ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) { return this.pickups.cancel(id, req.user, req.ip ?? null); }
	@Patch(":requestId/approve") approve(@Param("requestId", ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) { return this.pickups.approve(id, req.user, req.ip ?? null); }
	@Patch(":requestId/reject") reject(@Param("requestId", ParseUUIDPipe) id: string, @Body() dto: RejectPickupRequestDto, @Req() req: AuthenticatedRequest) { return this.pickups.reject(id, dto, req.user, req.ip ?? null); }
	@Patch(":requestId/complete") complete(@Param("requestId", ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) { return this.pickups.complete(id, req.user, req.ip ?? null); }
}
