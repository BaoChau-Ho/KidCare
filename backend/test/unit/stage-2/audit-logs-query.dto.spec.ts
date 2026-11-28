import "reflect-metadata";
import { invalidFields } from "../../helpers/mocks";
import { ListAuditLogsQueryDto } from "../../../src/audit-logs/dto/list-audit-logs-query.dto";

describe("ListAuditLogsQueryDto", () => {
	it("accepts calendar dates and rejects timestamps before they can become Invalid Date", async () => {
		expect(await invalidFields(ListAuditLogsQueryDto, { from: "2026-11-01", to: "2026-11-30" })).toEqual([]);
		expect(await invalidFields(ListAuditLogsQueryDto, {
			from: "2026-11-01T00:00:00Z",
			to: "2026-11-30T23:59:59Z",
		})).toEqual(["from", "to"]);
	});
});
