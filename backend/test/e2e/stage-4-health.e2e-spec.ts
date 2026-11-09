import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { load } from "js-yaml";
import { INestApplication } from "@nestjs/common";
import type { Response } from "supertest";
import { DataSource } from "typeorm";
import { addDays, todayInSchool } from "../../src/common/school-time";
import { api, createTestApp, resetDatabase, seedWorld } from "../helpers/test-app";
import type { World } from "../helpers/test-app";

// Giai đoạn 4 — hồ sơ sức khỏe (UC-09). Test viết trước code, theo hợp đồng trong docs/02-design/openapi.yaml:
// đơn vị cm, kg, °C; khoảng hợp lệ 30-150 cm, 2-50 kg, 34-42 °C; cảnh báo khi nhiệt độ >= 37.5 hoặc <= 35.
// Chỉ gọi API qua HTTP nên không phụ thuộc tên entity, service hay bảng mà backend sẽ đặt.
//
// File tự bỏ qua khi src/ chưa có controller nào khai báo route health-records hoặc health-summary.
// Muốn chạy thử trước (để thấy test đỏ) thì đặt STAGE4_E2E=1.

const SRC = resolve(__dirname, "../../src");
const healthApiExists = () =>
	readdirSync(SRC, { recursive: true })
		.map(String)
		.filter((file) => file.endsWith(".controller.ts"))
		.some((file) => /health-records|health-summary/.test(readFileSync(join(SRC, file), "utf8")));
const maybe = process.env.STAGE4_E2E === "1" || healthApiExists() ? describe : describe.skip;

const SPEC_PATH = resolve(__dirname, "../../../docs/02-design/openapi.yaml");

type Json = Record<string, any>;
// Sắp xếp ổn định để so sánh danh sách không quy định thứ tự
const sorted = <T>(items: T[]) => [...items].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
type Who = "manager" | "teacherA" | "teacherB" | "parentA" | "parentB" | "medical" | "admin";

// Chuỗi đánh dấu thông tin nhạy cảm: không được lọt ra cho phụ huynh, giáo viên, hay vào audit log.
const NOTE_RECORD = "GHI-CHU-SO-DO-NHAY-CAM";
const NOTE_ALLERGY = "GHI-CHU-DI-UNG-NHAY-CAM";
const NOTE_CONDITION = "GHI-CHU-BENH-NEN-NHAY-CAM";
const SYMPTOMS = "Ho, sổ mũi TRIEU-CHUNG-NHAY-CAM";
const CONCLUSION = "KET-LUAN-CHAN-DOAN-NHAY-CAM";
const SECRETS = [NOTE_RECORD, NOTE_ALLERGY, NOTE_CONDITION, CONCLUSION];

maybe("GĐ4 · hồ sơ sức khỏe (UC-09)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let w: World;
	let spec: { paths: Record<string, Record<string, { responses: Record<string, { content?: { "application/json"?: { schema?: unknown } } }> }>>; components: unknown };
	let ajv: Ajv2020;

	const http = () => api(app);
	const today = () => todayInSchool();
	const as = (who: Who) => w[who];

	// Các thao tác của nhân viên y tế, dùng để dựng dữ liệu
	const postRecord = (body: Json, childId = w.an.id) => http().post(`/children/${childId}/health-records`, w.medical).send(body);
	const postAllergy = (body: Json, childId = w.an.id) => http().post(`/children/${childId}/allergies`, w.medical).send(body);
	const postCondition = (body: Json, childId = w.an.id) => http().post(`/children/${childId}/medical-conditions`, w.medical).send(body);
	const postVaccination = (body: Json, childId = w.an.id) => http().post(`/children/${childId}/vaccinations`, w.medical).send(body);
	const postVisit = (body: Json, childId = w.an.id) => http().post(`/children/${childId}/medical-visits`, w.medical).send(body);
	const summary = (who: Who, childId = w.an.id) => http().get(`/children/${childId}/health-summary`, as(who));

	// Hồ sơ đầy đủ của bé An: 1 số đo sốt, 1 dị ứng đang theo dõi + 1 đã ngừng, 1 bệnh nền, 1 mũi tiêm sắp hẹn, 1 lần khám
	async function seedHealth() {
		const record = (await postRecord({ height: 95.5, weight: 14.2, temperature: 38, note: NOTE_RECORD }).expect(201)).body as Json;
		const peanut = (await postAllergy({ allergen: "Đậu phộng", severity: "SEVERE", note: NOTE_ALLERGY }).expect(201)).body as Json;
		const milk = (await postAllergy({ allergen: "Sữa bò", severity: "MILD" }).expect(201)).body as Json;
		await http().patch(`/allergies/${milk.id}`, w.medical).send({ active: false }).expect(200);
		const asthma = (await postCondition({ name: "Hen suyễn", note: NOTE_CONDITION }).expect(201)).body as Json;
		const vaccine = (await postVaccination({ vaccineName: "Sởi", doseNumber: 1, vaccinatedAt: addDays(today(), -20), nextDueDate: addDays(today(), 10) }).expect(201)).body as Json;
		const visit = (await postVisit({ symptoms: SYMPTOMS, conclusion: CONCLUSION, medications: [{ name: "Paracetamol", dosage: "5 ml", schedule: "Khi sốt, cách 6 giờ" }] }).expect(201)).body as Json;
		return { record, peanut, milk, asthma, vaccine, visit };
	}

	// Đối chiếu phản hồi với schema trong openapi.yaml
	const expectSchema = (path: string, method: string, res: Response) => {
		const schema = spec.paths[path]?.[method]?.responses[String(res.status)]?.content?.["application/json"]?.schema;
		const endpoint = `${method.toUpperCase()} ${path} -> ${res.status}`;
		if (!schema) throw new Error(`openapi.yaml không mô tả ${endpoint}`);
		const check = ajv.compile(JSON.parse(JSON.stringify(schema).replace(/"#\/components/g, '"spec#/components')));
		const problems = check(res.body) ? [] : (check.errors ?? []).map((e) => `${e.instancePath || "(gốc)"} ${e.message}`);
		expect({ endpoint, problems }).toEqual({ endpoint, problems: [] });
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

	/* ===================================================== số đo */
	describe("ghi số đo", () => {
		it("E2E-H4-01 nhân viên y tế ghi đủ 3 chỉ số → 201, server tự đặt recordedAt", async () => {
			const before = Date.now();
			const res = await postRecord({ height: 95.5, weight: 14.2, temperature: 36.8, note: "  Bé khỏe  " }).expect(201);
			expect(res.body).toMatchObject({ childId: w.an.id, height: 95.5, weight: 14.2, temperature: 36.8, abnormal: [] });
			expect(Date.parse(res.body.recordedAt)).toBeGreaterThanOrEqual(before - 60_000);
			expect(Date.parse(res.body.recordedAt)).toBeLessThanOrEqual(Date.now() + 60_000);
		});

		it.each([
			[{ height: 30 }], [{ height: 150 }], [{ weight: 2 }], [{ weight: 50 }], [{ temperature: 34 }], [{ temperature: 42 }],
		])("E2E-H4-02 giá trị ở đúng biên khoảng hợp lệ %j → 201", async (body) => {
			await postRecord(body).expect(201);
		});

		it.each([
			[{ height: 29.9 }], [{ height: 150.1 }], [{ weight: 1.9 }], [{ weight: 50.1 }], [{ temperature: 33.9 }], [{ temperature: 42.1 }],
			[{ height: 0 }], [{ weight: -5 }], [{ temperature: "abc" }],
		])("E2E-H4-03 giá trị ngoài khoảng hoặc không phải số %j → 400", async (body) => {
			await postRecord(body).expect(400);
		});

		it.each([[{}], [{ note: "Chỉ có ghi chú" }]])("E2E-H4-04 không có chỉ số nào %j → 400", async (body) => {
			await postRecord(body).expect(400);
		});

		it("E2E-H4-05 ghi chú tối đa 2000 ký tự; trường lạ bị từ chối", async () => {
			await postRecord({ height: 95, note: "a".repeat(2000) }).expect(201);
			await postRecord({ height: 95, note: "a".repeat(2001) }).expect(400);
			await postRecord({ height: 95, bmi: 15 }).expect(400);
		});

		it.each([
			[37.4, []], [37.5, ["TEMPERATURE"]], [38.5, ["TEMPERATURE"]],
			[35.1, []], [35, ["TEMPERATURE"]], [34.5, ["TEMPERATURE"]],
		])("E2E-H4-06 nhiệt độ %p → abnormal %j", async (temperature, abnormal) => {
			const res = await postRecord({ temperature }).expect(201);
			expect(res.body.abnormal).toEqual(abnormal);
		});

		it("E2E-H4-07 không đo nhiệt độ thì không có cảnh báo", async () => {
			expect((await postRecord({ height: 95, weight: 14 }).expect(201)).body.abnormal).toEqual([]);
		});

		it.each(["parentA", "teacherA", "manager", "admin"] as const)("E2E-H4-08 %s không được ghi số đo → 403", async (who) => {
			await http().post(`/children/${w.an.id}/health-records`, as(who)).send({ height: 95 }).expect(403);
		});

		it("E2E-H4-09 chưa đăng nhập → 401; trẻ không tồn tại → 404; childId không phải UUID → 400", async () => {
			await http().post(`/children/${w.an.id}/health-records`).send({ height: 95 }).expect(401);
			await postRecord({ height: 95 }, randomUUID()).expect(404);
			await postRecord({ height: 95 }, "khong-phai-uuid").expect(400);
		});
	});

	describe("xem lịch sử số đo", () => {
		it("E2E-H4-10 mới nhất trước, có phân trang", async () => {
			for (const temperature of [36.5, 36.7, 36.9]) await postRecord({ temperature }).expect(201);
			const res = await http().get(`/children/${w.an.id}/health-records?limit=2`, w.medical).expect(200);
			expect(res.body.pageInfo).toEqual({ page: 1, limit: 2, totalItems: 3, totalPages: 2 });
			expect(res.body.items).toHaveLength(2);
			const times = (res.body.items as Json[]).map((r) => Date.parse(r.recordedAt));
			expect(times[0]).toBeGreaterThanOrEqual(times[1]);
			expect(res.body.items[0].temperature).toBe(36.9);
		});

		it("E2E-H4-11 chỉ thấy số đo của đúng trẻ được hỏi", async () => {
			await postRecord({ height: 95 }).expect(201);
			await postRecord({ height: 100 }, w.binh.id).expect(201);
			const res = await http().get(`/children/${w.binh.id}/health-records`, w.medical).expect(200);
			expect((res.body.items as Json[]).map((r) => r.height)).toEqual([100]);
		});

		it.each(["parentA", "teacherA", "manager", "admin"] as const)("E2E-H4-12 %s không được xem lịch sử chi tiết → 403", async (who) => {
			await http().get(`/children/${w.an.id}/health-records`, as(who)).expect(403);
		});
	});

	describe("sửa số đo", () => {
		it("E2E-H4-13 sửa nhiệt độ → giữ các chỉ số khác, tính lại cảnh báo", async () => {
			const rec = (await postRecord({ height: 95, temperature: 36.5 }).expect(201)).body as Json;
			const fever = await http().patch(`/health-records/${rec.id}`, w.medical).send({ temperature: 38.2 }).expect(200);
			expect(fever.body).toMatchObject({ id: rec.id, height: 95, temperature: 38.2, abnormal: ["TEMPERATURE"] });
			const cleared = await http().patch(`/health-records/${rec.id}`, w.medical).send({ temperature: null }).expect(200);
			expect(cleared.body).toMatchObject({ height: 95, temperature: null, abnormal: [] });
		});

		it("E2E-H4-14 không cho sửa ra ngoài khoảng, xóa hết chỉ số, hoặc gửi body rỗng → 400", async () => {
			const rec = (await postRecord({ height: 95 }).expect(201)).body as Json;
			await http().patch(`/health-records/${rec.id}`, w.medical).send({ height: 151 }).expect(400);
			await http().patch(`/health-records/${rec.id}`, w.medical).send({ height: null }).expect(400);
			await http().patch(`/health-records/${rec.id}`, w.medical).send({}).expect(400);
		});

		it("E2E-H4-15 bản ghi không tồn tại → 404; người không phải y tế → 403", async () => {
			const rec = (await postRecord({ height: 95 }).expect(201)).body as Json;
			await http().patch(`/health-records/${randomUUID()}`, w.medical).send({ height: 96 }).expect(404);
			await http().patch(`/health-records/${rec.id}`, w.parentA).send({ height: 96 }).expect(403);
			await http().patch(`/health-records/${rec.id}`, w.teacherA).send({ height: 96 }).expect(403);
		});
	});

	/* ===================================================== dị ứng, bệnh nền */
	describe("dị ứng", () => {
		it("E2E-H4-16 ghi dị ứng → 201, tác nhân được trim, mặc định đang theo dõi", async () => {
			const res = await postAllergy({ allergen: "  Đậu phộng  ", severity: "SEVERE", note: "Mang theo bút tiêm" }).expect(201);
			expect(res.body).toMatchObject({ childId: w.an.id, allergen: "Đậu phộng", severity: "SEVERE", active: true });
		});

		it.each([
			[{ allergen: "Tôm", severity: "HIGH" }], [{ allergen: "Tôm", severity: "mild" }], [{ allergen: "Tôm" }],
			[{ allergen: "   ", severity: "MILD" }], [{ severity: "MILD" }], [{ allergen: "a".repeat(201), severity: "MILD" }],
		])("E2E-H4-17 dữ liệu không hợp lệ %j → 400", async (body) => {
			await postAllergy(body).expect(400);
		});

		it("E2E-H4-18 trùng tác nhân đang theo dõi (không phân biệt hoa thường) → 409; ngừng theo dõi rồi thì ghi lại được", async () => {
			const first = (await postAllergy({ allergen: "Tôm", severity: "MILD" }).expect(201)).body as Json;
			await postAllergy({ allergen: "TÔM", severity: "SEVERE" }).expect(409);
			await http().patch(`/allergies/${first.id}`, w.medical).send({ active: false }).expect(200);
			await postAllergy({ allergen: "tôm", severity: "SEVERE" }).expect(201);
			// Bật lại mục cũ khi đã có mục mới cùng tác nhân → 409
			await http().patch(`/allergies/${first.id}`, w.medical).send({ active: true }).expect(409);
		});

		it("E2E-H4-19 cùng tác nhân ở hai trẻ khác nhau không bị coi là trùng", async () => {
			await postAllergy({ allergen: "Tôm", severity: "MILD" }).expect(201);
			await postAllergy({ allergen: "Tôm", severity: "MILD" }, w.binh.id).expect(201);
		});

		it("E2E-H4-20 sửa mức độ → 200; mức độ sai → 400; không tồn tại → 404", async () => {
			const a = (await postAllergy({ allergen: "Tôm", severity: "MILD" }).expect(201)).body as Json;
			expect((await http().patch(`/allergies/${a.id}`, w.medical).send({ severity: "MODERATE" }).expect(200)).body.severity).toBe("MODERATE");
			await http().patch(`/allergies/${a.id}`, w.medical).send({ severity: "VERY_HIGH" }).expect(400);
			await http().patch(`/allergies/${randomUUID()}`, w.medical).send({ severity: "MILD" }).expect(404);
		});

		it("E2E-H4-21 danh sách cho y tế gồm cả mục đã ngừng theo dõi", async () => {
			const a = (await postAllergy({ allergen: "Tôm", severity: "MILD" }).expect(201)).body as Json;
			await postAllergy({ allergen: "Trứng", severity: "MODERATE" }).expect(201);
			await http().patch(`/allergies/${a.id}`, w.medical).send({ active: false }).expect(200);
			const res = await http().get(`/children/${w.an.id}/allergies`, w.medical).expect(200);
			expect(sorted((res.body.items as Json[]).map((x) => [x.allergen, x.active]))).toEqual(sorted([["Trứng", true], ["Tôm", false]]));
		});
	});

	describe("bệnh nền", () => {
		it("E2E-H4-22 ghi bệnh nền → 201; tên rỗng → 400; trùng tên đang theo dõi → 409", async () => {
			const res = await postCondition({ name: " Hen suyễn ", note: "Có bình xịt trong cặp" }).expect(201);
			expect(res.body).toMatchObject({ childId: w.an.id, name: "Hen suyễn", active: true });
			await postCondition({ name: "   " }).expect(400);
			await postCondition({}).expect(400);
			await postCondition({ name: "hen suyễn" }).expect(409);
		});

		it("E2E-H4-23 ngừng theo dõi → 200 và không còn trong tóm tắt", async () => {
			const c = (await postCondition({ name: "Hen suyễn" }).expect(201)).body as Json;
			await http().patch(`/medical-conditions/${c.id}`, w.medical).send({ active: false }).expect(200);
			expect((await summary("medical").expect(200)).body.medicalConditions).toEqual([]);
			await http().patch(`/medical-conditions/${randomUUID()}`, w.medical).send({ active: false }).expect(404);
		});
	});

	describe("quyền với dị ứng và bệnh nền", () => {
		it.each(["parentA", "teacherA", "manager"] as const)("E2E-H4-24 %s không được xem, ghi hay sửa → 403", async (who) => {
			const a = (await postAllergy({ allergen: "Tôm", severity: "MILD" }).expect(201)).body as Json;
			const c = (await postCondition({ name: "Hen suyễn" }).expect(201)).body as Json;
			await http().get(`/children/${w.an.id}/allergies`, as(who)).expect(403);
			await http().post(`/children/${w.an.id}/allergies`, as(who)).send({ allergen: "Trứng", severity: "MILD" }).expect(403);
			await http().patch(`/allergies/${a.id}`, as(who)).send({ active: false }).expect(403);
			await http().get(`/children/${w.an.id}/medical-conditions`, as(who)).expect(403);
			await http().post(`/children/${w.an.id}/medical-conditions`, as(who)).send({ name: "Động kinh" }).expect(403);
			await http().patch(`/medical-conditions/${c.id}`, as(who)).send({ active: false }).expect(403);
		});
	});

	/* ===================================================== tiêm chủng */
	describe("tiêm chủng", () => {
		it("E2E-H4-25 ghi mũi tiêm → 201; không có ngày hẹn thì nextDueDate = null", async () => {
			const past = addDays(today(), -30);
			const res = await postVaccination({ vaccineName: " Viêm gan B ", doseNumber: 1, vaccinatedAt: past }).expect(201);
			expect(res.body).toMatchObject({ childId: w.an.id, vaccineName: "Viêm gan B", doseNumber: 1, vaccinatedAt: past, nextDueDate: null });
		});

		it.each([[1, 201], [10, 201], [0, 400], [11, 400], [1.5, 400]])("E2E-H4-26 mũi số %p → %p", async (doseNumber, status) => {
			await postVaccination({ vaccineName: `Vắc-xin ${doseNumber}`, doseNumber, vaccinatedAt: addDays(today(), -1) }).expect(status);
		});

		it("E2E-H4-27 ngày tiêm hôm nay được, ngày mai thì không; ngày hẹn phải sau ngày tiêm", async () => {
			await postVaccination({ vaccineName: "Sởi", doseNumber: 1, vaccinatedAt: today() }).expect(201);
			await postVaccination({ vaccineName: "Sởi", doseNumber: 2, vaccinatedAt: addDays(today(), 1) }).expect(400);
			const day = addDays(today(), -10);
			await postVaccination({ vaccineName: "Thủy đậu", doseNumber: 1, vaccinatedAt: day, nextDueDate: day }).expect(400);
			await postVaccination({ vaccineName: "Thủy đậu", doseNumber: 1, vaccinatedAt: day, nextDueDate: addDays(day, -1) }).expect(400);
			await postVaccination({ vaccineName: "Thủy đậu", doseNumber: 1, vaccinatedAt: day, nextDueDate: addDays(day, 1) }).expect(201);
			await postVaccination({ vaccineName: "Bại liệt", doseNumber: 1, vaccinatedAt: "2026-02-30" }).expect(400);
		});

		it("E2E-H4-28 trùng tên vắc-xin (không phân biệt hoa thường) và mũi → 409; khác mũi thì được", async () => {
			const day = addDays(today(), -10);
			await postVaccination({ vaccineName: "Sởi", doseNumber: 1, vaccinatedAt: day }).expect(201);
			await postVaccination({ vaccineName: "SỞI", doseNumber: 1, vaccinatedAt: addDays(day, 1) }).expect(409);
			await postVaccination({ vaccineName: "Sởi", doseNumber: 2, vaccinatedAt: addDays(day, 1) }).expect(201);
		});

		it("E2E-H4-29 danh sách: ngày tiêm mới nhất trước, có phân trang; chỉ y tế được xem", async () => {
			await postVaccination({ vaccineName: "Sởi", doseNumber: 1, vaccinatedAt: addDays(today(), -60) }).expect(201);
			await postVaccination({ vaccineName: "Sởi", doseNumber: 2, vaccinatedAt: addDays(today(), -10) }).expect(201);
			const res = await http().get(`/children/${w.an.id}/vaccinations?limit=1`, w.medical).expect(200);
			expect(res.body.pageInfo).toEqual({ page: 1, limit: 1, totalItems: 2, totalPages: 2 });
			expect(res.body.items[0].doseNumber).toBe(2);
			await http().get(`/children/${w.an.id}/vaccinations`, w.parentA).expect(403);
			await http().post(`/children/${w.an.id}/vaccinations`, w.teacherA).send({ vaccineName: "Sởi", doseNumber: 3, vaccinatedAt: today() }).expect(403);
		});
	});

	/* ===================================================== lần khám */
	describe("lần khám", () => {
		it("E2E-H4-30 ghi lần khám kèm thuốc → 201", async () => {
			const visitedAt = new Date(Date.now() - 3_600_000).toISOString();
			const meds = [{ name: "Paracetamol", dosage: "5 ml", schedule: "Khi sốt" }];
			const res = await postVisit({ visitedAt, symptoms: "Sốt", conclusion: "Viêm họng", medications: meds }).expect(201);
			expect(res.body).toMatchObject({ childId: w.an.id, symptoms: "Sốt", conclusion: "Viêm họng", medications: meds });
			expect(Date.parse(res.body.visitedAt)).toBe(Date.parse(visitedAt));
		});

		it("E2E-H4-31 không gửi visitedAt thì lấy thời điểm hiện tại; chỉ cần triệu chứng hoặc kết luận", async () => {
			const res = await postVisit({ symptoms: "Ho" }).expect(201);
			expect(Math.abs(Date.parse(res.body.visitedAt) - Date.now())).toBeLessThan(60_000);
			expect(res.body.medications).toEqual([]);
			await postVisit({ conclusion: "Bình thường" }).expect(201);
		});

		it.each([
			["thiếu cả triệu chứng và kết luận", {}],
			["triệu chứng và kết luận rỗng", { symptoms: "", conclusion: "" }],
			["thuốc thiếu liều", { symptoms: "Ho", medications: [{ name: "Siro ho", schedule: "Sáng, tối" }] }],
			["thuốc có lịch dùng rỗng", { symptoms: "Ho", medications: [{ name: "Siro ho", dosage: "5 ml", schedule: "" }] }],
			["quá 20 loại thuốc", { symptoms: "Ho", medications: Array.from({ length: 21 }, (_, i) => ({ name: `Thuốc ${i}`, dosage: "1 viên", schedule: "Sáng" })) }],
			["triệu chứng quá 2000 ký tự", { symptoms: "a".repeat(2001) }],
			["thời điểm khám ở tương lai", { symptoms: "Ho", visitedAt: new Date(Date.now() + 2 * 3_600_000).toISOString() }],
			["thời điểm khám sai định dạng", { symptoms: "Ho", visitedAt: "hôm qua" }],
		])("E2E-H4-32 %s → 400", async (_label, body) => {
			await postVisit(body).expect(400);
		});

		it("E2E-H4-33 danh sách mới nhất trước, có phân trang; chỉ y tế được xem và ghi", async () => {
			await postVisit({ symptoms: "Lần 1", visitedAt: new Date(Date.now() - 2 * 86_400_000).toISOString() }).expect(201);
			await postVisit({ symptoms: "Lần 2", visitedAt: new Date(Date.now() - 86_400_000).toISOString() }).expect(201);
			const res = await http().get(`/children/${w.an.id}/medical-visits`, w.medical).expect(200);
			expect((res.body.items as Json[]).map((v) => v.symptoms)).toEqual(["Lần 2", "Lần 1"]);
			expect(res.body.pageInfo.totalItems).toBe(2);
			await http().get(`/children/${w.an.id}/medical-visits`, w.teacherA).expect(403);
			await http().post(`/children/${w.an.id}/medical-visits`, w.parentA).send({ symptoms: "Ho" }).expect(403);
		});
	});

	it.each(["health-records", "allergies", "medical-conditions", "vaccinations", "medical-visits", "health-summary"])(
		"E2E-H4-34 GET /children/{không tồn tại}/%s của y tế → 404",
		async (resource) => {
			await http().get(`/children/${randomUUID()}/${resource}`, w.medical).expect(404);
		},
	);

	/* ===================================================== tóm tắt theo vai trò */
	describe("tóm tắt sức khỏe lọc theo vai trò", () => {
		it("E2E-H4-35 y tế: view FULL, đủ ghi chú và kết luận, chỉ dị ứng đang theo dõi, có cảnh báo sốt", async () => {
			const s = await seedHealth();
			const res = await summary("medical").expect(200);
			expect(res.body).toMatchObject({ childId: w.an.id, childName: "An", view: "FULL", abnormal: ["TEMPERATURE"] });
			expect(res.body.latestRecord).toMatchObject({ id: s.record.id, note: NOTE_RECORD });
			expect((res.body.allergies as Json[]).map((a) => a.allergen)).toEqual(["Đậu phộng"]);
			expect(res.body.allergies[0].note).toBe(NOTE_ALLERGY);
			expect(res.body.medicalConditions[0]).toMatchObject({ name: "Hen suyễn", note: NOTE_CONDITION });
			expect(res.body.visits[0]).toMatchObject({ symptoms: SYMPTOMS, conclusion: CONCLUSION });
			expect((res.body.upcomingVaccinations as Json[]).map((v) => v.id)).toEqual([s.vaccine.id]);
		});

		it("E2E-H4-36 phụ huynh của trẻ: view PARENT, thấy số đo, dị ứng, tiêm chủng, triệu chứng và thuốc, không thấy ghi chú và kết luận", async () => {
			await seedHealth();
			const res = await summary("parentA").expect(200);
			expect(res.body.view).toBe("PARENT");
			expect(res.body.latestRecord).toMatchObject({ height: 95.5, weight: 14.2, temperature: 38 });
			expect(res.body.latestRecord).not.toHaveProperty("note");
			expect(res.body.allergies).toEqual([{ id: expect.any(String), allergen: "Đậu phộng", severity: "SEVERE" }]);
			expect(res.body.medicalConditions).toEqual([{ id: expect.any(String), name: "Hen suyễn" }]);
			expect(res.body.vaccinations).toHaveLength(1);
			expect(res.body.visits[0]).toMatchObject({ symptoms: SYMPTOMS, medications: [{ name: "Paracetamol", dosage: "5 ml", schedule: "Khi sốt, cách 6 giờ" }] });
			expect(res.body.visits[0]).not.toHaveProperty("conclusion");
			for (const secret of SECRETS) expect(JSON.stringify(res.body)).not.toContain(secret);
		});

		it("E2E-H4-37 giáo viên của lớp: view ALERT_ONLY, chỉ còn dị ứng và bệnh nền rút gọn", async () => {
			await seedHealth();
			const res = await summary("teacherA").expect(200);
			expect(res.body).toMatchObject({ view: "ALERT_ONLY", latestRecord: null, vaccinations: [], upcomingVaccinations: [], visits: [] });
			expect(res.body.allergies).toEqual([{ id: expect.any(String), allergen: "Đậu phộng", severity: "SEVERE" }]);
			expect(res.body.medicalConditions).toEqual([{ id: expect.any(String), name: "Hen suyễn" }]);
			for (const secret of [...SECRETS, SYMPTOMS]) expect(JSON.stringify(res.body)).not.toContain(secret);
		});

		it.each(["parentB", "teacherB", "manager", "admin"] as const)("E2E-H4-38 %s không liên quan tới bé An → 403", async (who) => {
			await summary(who).expect(403);
		});

		it("E2E-H4-39 trẻ chưa có dữ liệu: latestRecord null, các danh sách rỗng", async () => {
			const res = await summary("medical", w.binh.id).expect(200);
			expect(res.body).toMatchObject({ latestRecord: null, allergies: [], medicalConditions: [], vaccinations: [], upcomingVaccinations: [], visits: [] });
		});

		it("E2E-H4-40 latestRecord là số đo mới nhất", async () => {
			await postRecord({ height: 95 }).expect(201);
			const latest = (await postRecord({ height: 96 }).expect(201)).body as Json;
			expect((await summary("parentA").expect(200)).body.latestRecord).toMatchObject({ id: latest.id, height: 96 });
		});

		it("E2E-H4-41 mũi sắp tới gồm mũi hẹn trong 30 ngày tới và mũi đã quá hẹn, không gồm mũi hẹn sau 30 ngày", async () => {
			const day = addDays(today(), -60);
			const in30 = (await postVaccination({ vaccineName: "A", doseNumber: 1, vaccinatedAt: day, nextDueDate: addDays(today(), 30) }).expect(201)).body as Json;
			const overdue = (await postVaccination({ vaccineName: "B", doseNumber: 1, vaccinatedAt: day, nextDueDate: addDays(today(), -1) }).expect(201)).body as Json;
			await postVaccination({ vaccineName: "C", doseNumber: 1, vaccinatedAt: day, nextDueDate: addDays(today(), 31) }).expect(201);
			await postVaccination({ vaccineName: "D", doseNumber: 1, vaccinatedAt: day }).expect(201);
			const res = await summary("parentA").expect(200);
			expect(sorted((res.body.upcomingVaccinations as Json[]).map((v) => v.id))).toEqual(sorted([in30.id, overdue.id]));
			expect(res.body.vaccinations).toHaveLength(4);
		});

		it("E2E-H4-42 chỉ trả tối đa 10 lần khám gần nhất", async () => {
			for (let i = 12; i >= 1; i--) await postVisit({ symptoms: `Lần ${13 - i}`, visitedAt: new Date(Date.now() - i * 86_400_000).toISOString() }).expect(201);
			const res = await summary("medical").expect(200);
			expect(res.body.visits).toHaveLength(10);
			expect(res.body.visits[0].symptoms).toBe("Lần 12");
		});
	});

	/* ===================================================== cảnh báo của lớp */
	describe("cảnh báo sức khỏe của lớp", () => {
		it("E2E-H4-43 giáo viên lớp thấy dị ứng và bệnh nền đang theo dõi của trẻ đang học, không có ghi chú", async () => {
			await seedHealth();
			await postAllergy({ allergen: "Hải sản", severity: "MODERATE" }, w.withdrawn.id).expect(201);
			const res = await http().get(`/classes/${w.classA.id}/health-alerts`, w.teacherA).expect(200);
			const rows = sorted((res.body as Json[]).map((a) => [a.childName, a.kind, a.allergen, a.severity]));
			expect(rows).toEqual(sorted([["An", "ALLERGY", "Đậu phộng", "SEVERE"], ["An", "CONDITION", "Hen suyễn", null]]));
			for (const secret of SECRETS) expect(JSON.stringify(res.body)).not.toContain(secret);
		});

		it.each(["manager", "medical"] as const)("E2E-H4-44 %s xem được cảnh báo của mọi lớp", async (who) => {
			await postAllergy({ allergen: "Tôm", severity: "MILD" }, w.chi.id).expect(201);
			const res = await http().get(`/classes/${w.classB.id}/health-alerts`, as(who)).expect(200);
			expect((res.body as Json[]).map((a) => a.childName)).toEqual(["Chi"]);
		});

		it.each(["teacherB", "parentA", "admin"] as const)("E2E-H4-45 %s không xem được cảnh báo lớp Mầm 1 → 403", async (who) => {
			await http().get(`/classes/${w.classA.id}/health-alerts`, as(who)).expect(403);
		});

		it("E2E-H4-46 lớp không tồn tại → 404; lớp không có cảnh báo → mảng rỗng", async () => {
			await http().get(`/classes/${randomUUID()}/health-alerts`, w.manager).expect(404);
			expect((await http().get(`/classes/${w.classB.id}/health-alerts`, w.teacherB).expect(200)).body).toEqual([]);
		});
	});

	/* ===================================================== audit, hợp đồng */
	it("E2E-H4-47 mọi lần tạo và sửa đều có audit, nhưng audit không chứa ghi chú, triệu chứng hay kết luận", async () => {
		const count = async () => Number((await dataSource.query("SELECT count(*)::int AS n FROM audit_logs"))[0].n);
		const before = await count();
		await seedHealth(); // 6 lần tạo + 1 lần sửa
		expect(await count()).toBeGreaterThanOrEqual(before + 7);
		const logs = JSON.stringify(await dataSource.query("SELECT * FROM audit_logs"));
		for (const secret of [...SECRETS, SYMPTOMS]) expect(logs).not.toContain(secret);
	});

	it("E2E-H4-48 mọi phản hồi thành công khớp schema trong openapi.yaml", async () => {
		const s = await seedHealth();
		const c = `/children/${w.an.id}`;
		expectSchema("/children/{childId}/health-records", "post", await postRecord({ weight: 14.5 }));
		expectSchema("/children/{childId}/health-records", "get", await http().get(`${c}/health-records`, w.medical));
		expectSchema("/health-records/{recordId}", "patch", await http().patch(`/health-records/${s.record.id}`, w.medical).send({ note: "Đã hạ sốt" }));
		expectSchema("/children/{childId}/allergies", "post", await postAllergy({ allergen: "Trứng", severity: "MILD" }));
		expectSchema("/children/{childId}/allergies", "get", await http().get(`${c}/allergies`, w.medical));
		expectSchema("/allergies/{allergyId}", "patch", await http().patch(`/allergies/${s.peanut.id}`, w.medical).send({ severity: "MODERATE" }));
		expectSchema("/children/{childId}/medical-conditions", "post", await postCondition({ name: "Động kinh" }));
		expectSchema("/children/{childId}/medical-conditions", "get", await http().get(`${c}/medical-conditions`, w.medical));
		expectSchema("/medical-conditions/{conditionId}", "patch", await http().patch(`/medical-conditions/${s.asthma.id}`, w.medical).send({ note: null }));
		expectSchema("/children/{childId}/vaccinations", "post", await postVaccination({ vaccineName: "Sởi", doseNumber: 2, vaccinatedAt: today() }));
		expectSchema("/children/{childId}/vaccinations", "get", await http().get(`${c}/vaccinations`, w.medical));
		expectSchema("/children/{childId}/medical-visits", "post", await postVisit({ conclusion: "Ổn định" }));
		expectSchema("/children/{childId}/medical-visits", "get", await http().get(`${c}/medical-visits`, w.medical));
		for (const who of ["medical", "parentA", "teacherA"] as const) {
			expectSchema("/children/{childId}/health-summary", "get", await summary(who));
		}
		expectSchema("/classes/{classId}/health-alerts", "get", await http().get(`/classes/${w.classA.id}/health-alerts`, w.teacherA));
	});
});
