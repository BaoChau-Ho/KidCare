import {
	Body,
	Controller,
	Delete,
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
import { AssignTeachersDto } from "./dto/assign-teachers.dto";
import { CreateClassDto } from "./dto/create-class.dto";
import { ListClassesQueryDto } from "./dto/list-classes-query.dto";
import { UpdateClassDto } from "./dto/update-class.dto";
import { ClassesService } from "./classes.service";

@Controller("classes")
@UseGuards(JwtAuthGuard)
export class ClassesController {
	constructor(private readonly classesService: ClassesService) {}

	@Get()
	list(@Query() query: ListClassesQueryDto, @Req() request: AuthenticatedRequest) {
		return this.classesService.list(query, request.user);
	}

	@Post()
	create(@Body() dto: CreateClassDto, @Req() request: AuthenticatedRequest) {
		return this.classesService.create(dto, request.user, request.ip ?? null);
	}

	@Get(":classId")
	getOne(
		@Param("classId", ParseUUIDPipe) classId: string,
		@Req() request: AuthenticatedRequest,
	) {
		return this.classesService.getOne(classId, request.user);
	}

	@Patch(":classId")
	update(
		@Param("classId", ParseUUIDPipe) classId: string,
		@Body() dto: UpdateClassDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.classesService.update(classId, dto, request.user, request.ip ?? null);
	}

	@Post(":classId/teachers")
	@HttpCode(HttpStatus.OK)
	assignTeachers(
		@Param("classId", ParseUUIDPipe) classId: string,
		@Body() dto: AssignTeachersDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.classesService.assignTeachers(classId, dto, request.user, request.ip ?? null);
	}

	@Delete(":classId/teachers/:teacherUserId")
	@HttpCode(HttpStatus.NO_CONTENT)
	removeTeacher(
		@Param("classId", ParseUUIDPipe) classId: string,
		@Param("teacherUserId", ParseUUIDPipe) teacherUserId: string,
		@Req() request: AuthenticatedRequest,
	) {
		return this.classesService.removeTeacher(classId, teacherUserId, request.user, request.ip ?? null);
	}
}
