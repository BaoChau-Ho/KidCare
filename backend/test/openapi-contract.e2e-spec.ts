import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { load } from "js-yaml";
import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import { addDays, todayInSchool } from "../src/common/school-time";
import { api, createTestApp, resetDatabase, seedWorld } from "./helpers/test-app";
import type { World } from "./helpers/test-app";

// Đối chiếu phản hồi THẬT của backend với schema trong openapi.yaml (kiểu dữ liệu, trường bắt buộc, định dạng uuid/date/date-time).
// Đường dẫn spec: biến OPENAPI_PATH, mặc định ../docs/02-design/openapi.yaml. Không có file thì bỏ qua.
const SPEC_PATH = resolve(process.env.OPENAPI_PATH ?? "../docs/02-design/openapi.yaml");
const maybe = existsSync(SPEC_PATH) ? describe : describe.skip;

type Json = Record<string, unknown>;
const PAST = "2026-01-05";
const iso = (date: string, hhmm: string) => `${date}T${hhmm}:00+07:00`;

maybe("Stage 3 — phản hồi khớp openapi.yaml", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let w: World;
	let spec: { paths: Record<string, Record<string, { responses: Record<string, { content?: { "application/json"?: { schema?: unknown } } }> }>>; components: unknown };
	let ajv: Ajv2020;

	// Trả về các lỗi schema (mảng rỗng nếu khớp)
	const validate = (path: string, method: string, status: number, body: unknown): string[] => {
		const op = spec.paths[path]?.[method];
		if (!op) return [`spec không có ${method.toUpperCase()} ${path}`];
		const schema = op.responses[String(status)]?.content?.["application/json"]?.schema;
		if (!schema) return [`spec không mô tả phản hồi ${status} của ${method.toUpperCase()} ${path}`];
		const check = ajv.compile(JSON.parse(JSON.stringify(schema).replace(/"#\/components/g, '"spec#/components')));
		return check(body) ? [] : (check.errors ?? []).map((e) => `${e.instancePath || "(gốc)"} ${e.message}`);
	};
	const expectMatch = (path: string, method: string, res: { status: number; body: unknown }) => {
		const problems = validate(path, method, res.status, res.body);
		expect({ endpoint: `${method.toUpperCase()} ${path} -> ${res.status}`, problems }).toEqual({ endpoint: `${method.toUpperCase()} ${path} -> ${res.status}`, problems: [] });
	};

	beforeAll(async () => {
		spec = load(readFileSync(SPEC_PATH, "utf8")) as typeof spec;
		ajv = new Ajv2020({ strict: false, allErrors: true });
		addFormats(ajv);
		ajv.addSchema({ $id: "spec", components: spec.components });
		({ app, dataSource } = await createTestApp());
	});
	afterAll(async () => { await app?.close(); });
	beforeEach(async () => {
		await resetDatabase(dataSource);
		w = await seedWorld(dataSource);
	});

	it("điểm danh (UC-06)", async () => {
		const http = api(app);
		expectMatch("/classes/{classId}/attendance", "get", await http.get(`/classes/${w.classA.id}/attendance?date=${PAST}`, w.teacherA));
		const checkIn = await http.post("/attendance/check-in", w.teacherA).send({ childId: w.an.id, checkInTime: iso(PAST, "07:50") });
		expectMatch("/attendance/check-in", "post", checkIn);
		expectMatch("/attendance/check-in", "post", await http.post("/attendance/check-in", w.teacherA).send({ childId: w.binh.id, date: PAST, status: "ABSENT" }));
		expectMatch("/attendance/check-out", "post", await http.post("/attendance/check-out", w.teacherA).send({ childId: w.an.id, date: PAST, checkOutTime: iso(PAST, "15:00") }));
		expectMatch("/attendance/{attendanceId}", "patch", await http.patch(`/attendance/${(checkIn.body as Json).id}`, w.teacherA).send({ checkInTime: iso(PAST, "08:20") }));
		expectMatch("/classes/{classId}/attendance", "get", await http.get(`/classes/${w.classA.id}/attendance?date=${PAST}`, w.manager));
	});

	it("phụ huynh theo dõi con (UC-07)", async () => {
		const http = api(app);
		await http.post("/attendance/check-in", w.teacherA).send({ childId: w.an.id, checkInTime: iso(PAST, "07:50") }).expect(201);
		expectMatch("/children/{childId}/attendance/today", "get", await http.get(`/children/${w.an.id}/attendance/today`, w.parentA));
		expectMatch("/children/{childId}/attendance", "get", await http.get(`/children/${w.an.id}/attendance?limit=5`, w.parentA));
		expectMatch("/children/{childId}/attendance", "get", await http.get(`/children/${w.chi.id}/attendance`, w.parentB)); // danh sách rỗng
	});

	it("đơn xin nghỉ (UC-08)", async () => {
		const http = api(app);
		const d = (n: number) => addDays(todayInSchool(), n);
		const created = await http.post("/leave-requests", w.parentA).send({ childId: w.an.id, fromDate: d(1), toDate: d(2), reason: "Bé bị cảm" });
		expectMatch("/leave-requests", "post", created);
		expectMatch("/leave-requests", "get", await http.get("/leave-requests", w.teacherA));
		expectMatch("/leave-requests/{requestId}/approve", "post", await http.post(`/leave-requests/${(created.body as Json).id}/approve`, w.teacherA));
		const second = await http.post("/leave-requests", w.parentA).send({ childId: w.an.id, fromDate: d(5), toDate: d(5), reason: "x" });
		expectMatch("/leave-requests/{requestId}/reject", "post", await http.post(`/leave-requests/${(second.body as Json).id}/reject`, w.teacherA).send({ reason: "Không hợp lệ" }));
		const third = await http.post("/leave-requests", w.parentA).send({ childId: w.an.id, fromDate: d(8), toDate: d(8), reason: "x" });
		expectMatch("/leave-requests/{requestId}/cancel", "patch", await http.patch(`/leave-requests/${(third.body as Json).id}/cancel`, w.parentA));
	});
});
