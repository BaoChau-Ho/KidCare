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
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { UsersService } from "./users.service";
import { AdminGuard } from "../auth/admin.guard";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { ChangeUserRoleDto } from "./dto/change-user-role.dto";
import { ChangeUserStatusDto } from "./dto/change-user-status.dto";

@Controller("users")
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Get()
	@UseGuards(JwtAuthGuard)
	list(
		@Query() query: ListUsersQueryDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.usersService.list(query, request.user);
	}
	@Post()
	@UseGuards(JwtAuthGuard, AdminGuard)
    create(
        @Body() dto: CreateUserDto,
        @Req() request: AuthenticatedRequest,
    ) {
        return this.usersService.create(
            dto,
            request.user,
            request.ip ?? null,
        );
    }
    @Patch(":userId")
    @UseGuards(JwtAuthGuard, AdminGuard)
    update(
        @Param("userId", ParseUUIDPipe) userId: string,
        @Body() dto: UpdateUserDto,
        @Req() request: AuthenticatedRequest,
    ) {
        return this.usersService.update(
            userId,
            dto,
            request.user,
            request.ip ?? null,
        );
    }
    @Patch(":userId/role")
    @UseGuards(JwtAuthGuard, AdminGuard)
    changeRole(
        @Param("userId", ParseUUIDPipe) userId: string,
        @Body() dto: ChangeUserRoleDto,
        @Req() request: AuthenticatedRequest,
    ) {
        return this.usersService.changeRole(
            userId,
            dto,
            request.user,
            request.ip ?? null,
        );
    }
    @Patch(":userId/status")
    @UseGuards(JwtAuthGuard, AdminGuard)
    changeStatus(
        @Param("userId", ParseUUIDPipe) userId: string,
        @Body() dto: ChangeUserStatusDto,
        @Req() request: AuthenticatedRequest,
    ) {
        return this.usersService.changeStatus(
            userId,
            dto,
            request.user,
            request.ip ?? null,
        );
    }
}
