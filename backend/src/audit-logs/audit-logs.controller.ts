import {
	Controller,
	Get,
	Query,
	UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto";
import { AuditLogsService } from "./audit-logs.service";

@Controller("audit-logs")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AuditLogsController {
	constructor(private readonly auditLogsService: AuditLogsService) {}

	@Get()
	list(@Query() query: ListAuditLogsQueryDto) {
		return this.auditLogsService.list(query);
	}
}