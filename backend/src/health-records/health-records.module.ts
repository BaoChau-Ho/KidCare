import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccessModule } from "../access/access.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { DomainEventsModule } from "../common/domain-events/domain-events.module";
import { AuthModule } from "../auth/auth.module";
import { Child } from "../children/child.entity";
import { Classroom } from "../classes/class.entity";
import { AllergiesService } from "./allergies.service";
import { Allergy } from "./allergy.entity";
import { HealthRecordsController } from "./health-records.controller";
import { HealthRecord } from "./health-record.entity";
import { HealthSummaryService } from "./health-summary.service";
import { ClassHealthAlertsService } from "./class-health-alerts.service";
import { HealthRecordsService } from "./health-records.service";
import { MedicalCondition } from "./medical-condition.entity";
import { MedicalConditionsService } from "./medical-conditions.service";
import { MedicalVisit } from "./medical-visit.entity";
import { MedicalVisitsService } from "./medical-visits.service";
import { Medication } from "./medication.entity";
import { Vaccination } from "./vaccination.entity";
import { VaccinationsService } from "./vaccinations.service";

@Module({
	imports: [
		AuthModule,
		AccessModule,
		AuditLogsModule,
		DomainEventsModule,
		TypeOrmModule.forFeature([
			HealthRecord,
			Allergy,
			MedicalCondition,
			Vaccination,
			MedicalVisit,
			Medication,
			Child,
			Classroom,
		]),
	],
	controllers: [HealthRecordsController],
	providers: [
		HealthRecordsService,
		AllergiesService,
		MedicalConditionsService,
		VaccinationsService,
		MedicalVisitsService,
		HealthSummaryService,
		ClassHealthAlertsService,
	],
	exports: [
		HealthRecordsService,
		AllergiesService,
		MedicalConditionsService,
		VaccinationsService,
		MedicalVisitsService,
		HealthSummaryService,
		ClassHealthAlertsService,
	],
})
export class HealthRecordsModule {}
