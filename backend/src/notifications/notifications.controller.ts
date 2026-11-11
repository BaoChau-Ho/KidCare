import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { ListNotificationsQueryDto } from "./dto/list-notifications-query.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
	constructor(private readonly notifications: NotificationsService) {}

	@Get()
	list(@Query() query: ListNotificationsQueryDto, @Req() request: AuthenticatedRequest) {
		return this.notifications.list(request.user, query);
	}

	@Get("unread-count")
	unreadCount(@Req() request: AuthenticatedRequest) {
		return this.notifications.unreadCount(request.user);
	}

	@Patch(":notificationId/read")
	markRead(@Param("notificationId", ParseUUIDPipe) id: string, @Req() request: AuthenticatedRequest) {
		return this.notifications.markRead(id, request.user);
	}

	@Post("read-all")
	markAllRead(@Req() request: AuthenticatedRequest) {
		return this.notifications.markAllRead(request.user);
	}
}
