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
import { AttendanceService } from "./attendance.service";
import { AttendanceHistoryQueryDto } from "./dto/attendance-history-query.dto";
import { CheckInDto } from "./dto/check-in.dto";
import { CheckOutDto } from "./dto/check-out.dto";
import { RosterQueryDto } from "./dto/roster-query.dto";
import { UpdateAttendanceDto } from "./dto/update-attendance.dto";

// Controller không có tiền tố vì các đường dẫn nằm dưới /classes, /attendance và /children (xem openapi.yaml).
@Controller()
@UseGuards(JwtAuthGuard)
export class AttendanceController {
	constructor(private readonly attendanceService: AttendanceService) {}

	@Get("classes/:classId/attendance")
	roster(
		@Param("classId", ParseUUIDPipe) classId: string,
		@Query() query: RosterQueryDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.attendanceService.roster(classId, query, request.user);
	}

	@Post("attendance/check-in")
	checkIn(@Body() dto: CheckInDto, @Req() request: AuthenticatedRequest) {
		return this.attendanceService.checkIn(dto, request.user, request.ip ?? null);
	}

	@Post("attendance/check-out")
	@HttpCode(HttpStatus.OK)
	checkOut(@Body() dto: CheckOutDto, @Req() request: AuthenticatedRequest) {
		return this.attendanceService.checkOut(dto, request.user, request.ip ?? null);
	}

	@Patch("attendance/:attendanceId")
	update(
		@Param("attendanceId", ParseUUIDPipe) attendanceId: string,
		@Body() dto: UpdateAttendanceDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.attendanceService.update(attendanceId, dto, request.user, request.ip ?? null);
	}

	// UC-07: phụ huynh xem tình hình của con
	@Get("children/:childId/attendance/today")
	today(@Param("childId", ParseUUIDPipe) childId: string, @Req() request: AuthenticatedRequest) {
		return this.attendanceService.today(childId, request.user);
	}

	@Get("children/:childId/attendance")
	history(
		@Param("childId", ParseUUIDPipe) childId: string,
		@Query() query: AttendanceHistoryQueryDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.attendanceService.history(childId, query, request.user);
	}
}
