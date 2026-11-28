import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { ActivitiesService } from "./activities.service";
import type { ActivityUploadFile } from "./activities.service";
import { CreateActivityDto } from "./dto/create-activity.dto";
import { ListActivitiesQueryDto } from "./dto/list-activities-query.dto";
import { UpdateActivityParticipantsDto } from "./dto/update-activity-participants.dto";
import { ListChildActivitiesQueryDto } from "./dto/list-child-activities-query.dto";

@Controller()
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
	constructor(private readonly activities: ActivitiesService) {}

	@Get("activities") list(@Query() query: ListActivitiesQueryDto, @Req() req: AuthenticatedRequest) { return this.activities.list(query, req.user); }
	@Post("activities") create(@Body() dto: CreateActivityDto, @Req() req: AuthenticatedRequest) { return this.activities.create(dto, req.user, req.ip ?? null); }
	@Post("activities/:activityId/participants") addParticipants(
		@Param("activityId", ParseUUIDPipe) id: string, @Body() dto: UpdateActivityParticipantsDto, @Req() req: AuthenticatedRequest,
	) { return this.activities.addParticipants(id, dto.participants, req.user, req.ip ?? null); }
	@Post("activities/:activityId/images")
	@UseInterceptors(FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0 } }))
	image(@Param("activityId", ParseUUIDPipe) id: string, @UploadedFile() file: ActivityUploadFile | undefined, @Req() req: AuthenticatedRequest) {
		return this.activities.uploadImage(id, file, req.user, req.ip ?? null);
	}
	@Get("children/:childId/activities") childActivities(
		@Param("childId", ParseUUIDPipe) id: string,
		@Query() query: ListChildActivitiesQueryDto,
		@Req() req: AuthenticatedRequest,
	) {
		return this.activities.childActivities(id, query.page, query.limit, req.user);
	}
}
