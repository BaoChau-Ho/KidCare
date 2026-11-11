import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	ParseUUIDPipe,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { AllergiesService } from "./allergies.service";
import { CreateAllergyDto } from "./dto/create-allergy.dto";
import { CreateHealthRecordDto } from "./dto/create-health-record.dto";
import { CreateMedicalConditionDto } from "./dto/create-medical-condition.dto";
import { CreateMedicalVisitDto } from "./dto/create-medical-visit.dto";
import { CreateVaccinationDto } from "./dto/create-vaccination.dto";
import { ListHealthRecordsQueryDto } from "./dto/list-health-records-query.dto";
import { ListMedicalVisitsQueryDto } from "./dto/list-medical-visits-query.dto";
import { ListVaccinationsQueryDto } from "./dto/list-vaccinations-query.dto";
import { UpdateAllergyDto } from "./dto/update-allergy.dto";
import { UpdateHealthRecordDto } from "./dto/update-health-record.dto";
import { UpdateMedicalConditionDto } from "./dto/update-medical-condition.dto";
import { MedicalConditionsService } from "./medical-conditions.service";
import { VaccinationsService } from "./vaccinations.service";
import { HealthRecordsService } from "./health-records.service";
import { MedicalVisitsService } from "./medical-visits.service";
import { HealthSummaryService } from "./health-summary.service";
import { ClassHealthAlertsService } from "./class-health-alerts.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class HealthRecordsController {
	constructor(
		private readonly healthRecordsService: HealthRecordsService,
		private readonly allergiesService: AllergiesService,
		private readonly medicalConditionsService: MedicalConditionsService,
		private readonly vaccinationsService: VaccinationsService,
		private readonly medicalVisitsService: MedicalVisitsService,
		private readonly healthSummaryService: HealthSummaryService,
		private readonly classHealthAlertsService: ClassHealthAlertsService,
	) {}

	@Get("classes/:classId/health-alerts")
	listClassHealthAlerts(
		@Param("classId", ParseUUIDPipe) classId: string,
		@Req() request: AuthenticatedRequest,
	) {
		return this.classHealthAlertsService.list(classId, request.user);
	}

	@Get("children/:childId/health-summary")
	getHealthSummary(
		@Param("childId", ParseUUIDPipe) childId: string,
		@Req() request: AuthenticatedRequest,
	) {
		return this.healthSummaryService.get(childId, request.user);
	}

	@Get("children/:childId/medical-visits")
	listMedicalVisits(
		@Param("childId", ParseUUIDPipe) childId: string,
		@Query() query: ListMedicalVisitsQueryDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.medicalVisitsService.list(childId, query, request.user);
	}

	@Post("children/:childId/medical-visits")
	createMedicalVisit(
		@Param("childId", ParseUUIDPipe) childId: string,
		@Body() dto: CreateMedicalVisitDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.medicalVisitsService.create(
			childId,
			dto,
			request.user,
			request.ip ?? null,
		);
	}

	@Get("children/:childId/vaccinations")
	listVaccinations(
		@Param("childId", ParseUUIDPipe) childId: string,
		@Query() query: ListVaccinationsQueryDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.vaccinationsService.list(childId, query, request.user);
	}

	@Post("children/:childId/vaccinations")
	createVaccination(
		@Param("childId", ParseUUIDPipe) childId: string,
		@Body() dto: CreateVaccinationDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.vaccinationsService.create(
			childId,
			dto,
			request.user,
			request.ip ?? null,
		);
	}

	@Get("children/:childId/medical-conditions")
	listMedicalConditions(
		@Param("childId", ParseUUIDPipe) childId: string,
		@Req() request: AuthenticatedRequest,
	) {
		return this.medicalConditionsService.list(childId, request.user);
	}

	@Post("children/:childId/medical-conditions")
	createMedicalCondition(
		@Param("childId", ParseUUIDPipe) childId: string,
		@Body() dto: CreateMedicalConditionDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.medicalConditionsService.create(
			childId,
			dto,
			request.user,
			request.ip ?? null,
		);
	}

	@Patch("medical-conditions/:conditionId")
	@HttpCode(HttpStatus.OK)
	updateMedicalCondition(
		@Param("conditionId", ParseUUIDPipe) conditionId: string,
		@Body() dto: UpdateMedicalConditionDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.medicalConditionsService.update(
			conditionId,
			dto,
			request.user,
			request.ip ?? null,
		);
	}

	@Get("children/:childId/allergies")
	listAllergies(
		@Param("childId", ParseUUIDPipe) childId: string,
		@Req() request: AuthenticatedRequest,
	) {
		return this.allergiesService.list(childId, request.user);
	}

	@Post("children/:childId/allergies")
	createAllergy(
		@Param("childId", ParseUUIDPipe) childId: string,
		@Body() dto: CreateAllergyDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.allergiesService.create(
			childId,
			dto,
			request.user,
			request.ip ?? null,
		);
	}

	@Patch("allergies/:allergyId")
	@HttpCode(HttpStatus.OK)
	updateAllergy(
		@Param("allergyId", ParseUUIDPipe) allergyId: string,
		@Body() dto: UpdateAllergyDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.allergiesService.update(
			allergyId,
			dto,
			request.user,
			request.ip ?? null,
		);
	}

	@Get("children/:childId/health-records")
	list(
		@Param("childId", ParseUUIDPipe) childId: string,
		@Query() query: ListHealthRecordsQueryDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.healthRecordsService.list(childId, query, request.user);
	}

	@Post("children/:childId/health-records")
	create(
		@Param("childId", ParseUUIDPipe) childId: string,
		@Body() dto: CreateHealthRecordDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.healthRecordsService.create(
			childId,
			dto,
			request.user,
			request.ip ?? null,
		);
	}

	@Patch("health-records/:recordId")
	@HttpCode(HttpStatus.OK)
	update(
		@Param("recordId", ParseUUIDPipe) recordId: string,
		@Body() dto: UpdateHealthRecordDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.healthRecordsService.update(
			recordId,
			dto,
			request.user,
			request.ip ?? null,
		);
	}
}
