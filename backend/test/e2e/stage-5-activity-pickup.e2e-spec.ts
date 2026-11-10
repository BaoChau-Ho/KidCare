import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import { addDays, todayInSchool } from "../../src/common/school-time";
import { api, createTestApp, resetDatabase, seedWorld } from "../helpers/test-app";
import type { World } from "../helpers/test-app";
import { controllerMentions, describeWhen, openApiMatcher } from "./helpers/spec-first";

// Giai đoạn 5 — hoạt động (UC-10) và đón trẻ (UC-11, UC-12). Test viết trước code, theo hợp đồng trong docs/02-design/openapi.yaml.
// Chỉ gọi API qua HTTP nên không phụ thuộc tên entity, service hay bảng mà backend sẽ đặt.
//
// Mỗi nhóm tự bỏ qua cho tới khi src/ có controller tương ứng: "activities" cho UC-10, "pickup-requests" cho UC-11/12.
// Muốn chạy thử trước (để thấy test đỏ) thì đặt STAGE5_E2E=1.

const ACTIVITIES = controllerMentions(/["'`/]activities\b/);
const PICKUPS = controllerMentions(/pickup-requests/);

type Json = Record<string, any>;
type Who = "manager" | "teacherA" | "teacherB" | "parentA" | "parentB" | "medical" | "admin";
const sorted = <T>(items: T[]) => [...items].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

// Ảnh 1x1 thật (đủ magic bytes) để backend kiểm tra theo nội dung
const IMAGES = {
	png: { buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"), filename: "anh.png", contentType: "image/png" },
	jpeg: { buffer: Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64"), filename: "anh.jpg", contentType: "image/jpeg" },
	webp: { buffer: Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64"), filename: "anh.webp", contentType: "image/webp" },
	gif: { buffer: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"), filename: "anh.gif", contentType: "image/gif" },
};
// Số giấy tờ và số điện thoại dùng làm chuỗi đánh dấu: không được lọt vào audit, không hiện đủ cho phụ huynh
const ID_NUMBER = "001203004567";
const PHONE = "0912 345 678";

describeWhen(ACTIVITIES || PICKUPS, "STAGE5_E2E")("GĐ5 · hoạt động và đón trẻ (UC-10, UC-11, UC-12)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let w: World;
	let expectSchema: ReturnType<typeof openApiMatcher>;

	const http = () => api(app);
	const today = () => todayInSchool();
	const as = (who: Who) => w[who];

	beforeAll(async () => {
		expectSchema = openApiMatcher();
		({ app, dataSource } = await createTestApp());
	});
	afterAll(async () => { await app?.close(); });
	beforeEach(async () => {
		await resetDatabase(dataSource);
		w = await seedWorld(dataSource);
	});

	/* ===================================================== UC-10 hoạt động */
	describeWhen(ACTIVITIES, "STAGE5_E2E")("UC-10 hoạt động", () => {
		const joined = (...ids: string[]) => ids.map((childId) => ({ childId, participationStatus: "JOINED" }));
		const createActivity = (body: Json, who: Who = "teacherA") =>
			http().post("/activities", as(who)).send({ classId: w.classA.id, title: "Tô màu", date: today(), ...body });
		const upload = (activityId: string, file: { buffer: Buffer; filename: string; contentType: string }, who: Who = "teacherA") =>
			http().post(`/activities/${activityId}/images`, as(who)).attach("file", file.buffer, { filename: file.filename, contentType: file.contentType });
		const totalActivities = async () => (await http().get("/activities", w.manager).expect(200)).body.pageInfo.totalItems as number;

		describe("tạo hoạt động", () => {
			it("E2E-A5-01 giáo viên của lớp tạo hoạt động kèm trẻ tham gia → 201", async () => {
				const res = await createActivity({ title: "  Tô màu lá cây  ", description: "Dùng màu nước", participants: joined(w.an.id, w.binh.id) }).expect(201);
				expect(res.body).toMatchObject({ classId: w.classA.id, title: "Tô màu lá cây", description: "Dùng màu nước", date: today(), createdByTeacherUserId: w.teacherA.id, images: [] });
				expect(sorted((res.body.participants as Json[]).map((p) => [p.childId, p.participationStatus]))).toEqual(sorted([[w.an.id, "JOINED"], [w.binh.id, "JOINED"]]));
			});

			it("E2E-A5-02 không có participants và không có mô tả vẫn hợp lệ; ngày trong quá khứ được", async () => {
				const res = await createActivity({ date: addDays(today(), -7) }).expect(201);
				expect(res.body).toMatchObject({ description: null, participants: [], date: addDays(today(), -7) });
			});

			it.each([
				["tiêu đề rỗng", { title: "" }],
				["tiêu đề toàn dấu cách", { title: "   " }],
				["tiêu đề quá 200 ký tự", { title: "a".repeat(201) }],
				["mô tả quá 5000 ký tự", { description: "a".repeat(5001) }],
				["thiếu ngày", { date: undefined }],
				["ngày sai định dạng", { date: "09/11/2026" }],
				["ngày ở tương lai", { date: "TOMORROW" }],
				["participationStatus lạ", { participants: [{ childId: "AN", participationStatus: "MAYBE" }] }],
				["childId không phải UUID", { participants: [{ childId: "abc", participationStatus: "JOINED" }] }],
				["trường lạ", { location: "Sân trường" }],
			])("E2E-A5-03 %s → 400", async (_label, patch) => {
				const body: Json = { ...patch };
				if (body.date === "TOMORROW") body.date = addDays(today(), 1);
				if (body.participants?.[0]?.childId === "AN") body.participants[0].childId = w.an.id;
				await createActivity(body).expect(400);
			});

			it.each([
				["trẻ lớp khác", "chi"],
				["trẻ đã nghỉ học", "withdrawn"],
			] as const)("E2E-A5-04 participants có %s → 400 và không lưu hoạt động nào", async (_label, child) => {
				await createActivity({ participants: joined(w.an.id, w[child].id) }).expect(400);
				expect(await totalActivities()).toBe(0);
			});

			it("E2E-A5-05 childId lặp lại chỉ được ghi một lần", async () => {
				const res = await createActivity({ participants: joined(w.an.id, w.an.id) }).expect(201);
				expect(res.body.participants).toHaveLength(1);
			});

			it("E2E-A5-06 lớp đã đóng → 409; lớp không tồn tại → 404", async () => {
				await dataSource.query("UPDATE classes SET status = 'CLOSED' WHERE id = $1", [w.classA.id]);
				await createActivity({}).expect(409);
				await createActivity({ classId: randomUUID() }).expect(404);
			});

			it.each(["teacherB", "parentA", "manager", "medical", "admin"] as const)("E2E-A5-07 %s không tạo được hoạt động cho lớp Mầm 1 → 403", async (who) => {
				await createActivity({}, who).expect(403);
			});

			it("E2E-A5-08 chưa đăng nhập → 401", async () => {
				await http().post("/activities").send({ classId: w.classA.id, title: "x", date: today() }).expect(401);
			});
		});

		describe("danh sách hoạt động", () => {
			it("E2E-A5-09 giáo viên chỉ thấy lớp mình; ngày mới nhất trước; có phân trang", async () => {
				await createActivity({ title: "Cũ", date: addDays(today(), -3) }).expect(201);
				await createActivity({ title: "Mới", date: today() }).expect(201);
				await createActivity({ title: "Giữa", date: addDays(today(), -1) }).expect(201);
				await http().post("/activities", w.teacherB).send({ classId: w.classB.id, title: "Lớp B", date: today() }).expect(201);
				const res = await http().get("/activities?limit=2", w.teacherA).expect(200);
				expect(res.body.pageInfo).toEqual({ page: 1, limit: 2, totalItems: 3, totalPages: 2 });
				expect((res.body.items as Json[]).map((a) => a.title)).toEqual(["Mới", "Giữa"]);
			});

			it("E2E-A5-10 quản lý thấy mọi lớp và lọc được theo lớp, theo ngày", async () => {
				await createActivity({ title: "A hôm nay" }).expect(201);
				await createActivity({ title: "A hôm qua", date: addDays(today(), -1) }).expect(201);
				await http().post("/activities", w.teacherB).send({ classId: w.classB.id, title: "B hôm nay", date: today() }).expect(201);
				expect((await http().get("/activities", w.manager).expect(200)).body.pageInfo.totalItems).toBe(3);
				const byClass = await http().get(`/activities?classId=${w.classB.id}`, w.manager).expect(200);
				expect((byClass.body.items as Json[]).map((a) => a.title)).toEqual(["B hôm nay"]);
				const byDate = await http().get(`/activities?date=${addDays(today(), -1)}`, w.manager).expect(200);
				expect((byDate.body.items as Json[]).map((a) => a.title)).toEqual(["A hôm qua"]);
			});

			it("E2E-A5-11 giáo viên lọc lớp không phụ trách → 403; phụ huynh, y tế, quản trị → 403", async () => {
				await http().get(`/activities?classId=${w.classB.id}`, w.teacherA).expect(403);
				for (const who of ["parentA", "medical", "admin"] as const) await http().get("/activities", as(who)).expect(403);
			});
		});

		describe("ghi nhận trẻ tham gia", () => {
			it("E2E-A5-12 thêm trẻ mới và đổi trạng thái trẻ cũ; trả toàn bộ danh sách", async () => {
				const a = (await createActivity({ participants: joined(w.an.id) }).expect(201)).body as Json;
				const res = await http().post(`/activities/${a.id}/participants`, w.teacherA)
					.send({ participants: [{ childId: w.binh.id, participationStatus: "JOINED" }, { childId: w.an.id, participationStatus: "NOT_JOINED" }] })
					.expect(200);
				expect(sorted((res.body as Json[]).map((p) => [p.childId, p.participationStatus, p.activityId]))).toEqual(sorted([[w.an.id, "NOT_JOINED", a.id], [w.binh.id, "JOINED", a.id]]));
			});

			it("E2E-A5-13 trẻ lớp khác → 400 và không thay đổi gì; danh sách rỗng → 400", async () => {
				const a = (await createActivity({ participants: joined(w.an.id) }).expect(201)).body as Json;
				await http().post(`/activities/${a.id}/participants`, w.teacherA).send({ participants: joined(w.binh.id, w.chi.id) }).expect(400);
				await http().post(`/activities/${a.id}/participants`, w.teacherA).send({ participants: [] }).expect(400);
				const list = await http().get("/activities", w.teacherA).expect(200);
				expect((list.body.items[0].participants as Json[]).map((p) => p.childId)).toEqual([w.an.id]);
			});

			it("E2E-A5-14 giáo viên lớp khác, phụ huynh → 403; hoạt động không tồn tại → 404", async () => {
				const a = (await createActivity({}).expect(201)).body as Json;
				await http().post(`/activities/${a.id}/participants`, w.teacherB).send({ participants: joined(w.an.id) }).expect(403);
				await http().post(`/activities/${a.id}/participants`, w.parentA).send({ participants: joined(w.an.id) }).expect(403);
				await http().post(`/activities/${randomUUID()}/participants`, w.teacherA).send({ participants: joined(w.an.id) }).expect(404);
			});
		});

		describe("ảnh hoạt động", () => {
			it.each(["png", "jpeg", "webp"] as const)("E2E-A5-15 ảnh %s hợp lệ → 201, có id, objectKey, url", async (kind) => {
				const a = (await createActivity({}).expect(201)).body as Json;
				const res = await upload(a.id, IMAGES[kind]).expect(201);
				expect(res.body).toMatchObject({ id: expect.any(String), objectKey: expect.any(String), url: expect.any(String) });
				const list = await http().get("/activities", w.teacherA).expect(200);
				expect((list.body.items[0].images as Json[]).map((i) => i.id)).toEqual([res.body.id]);
			});

			it("E2E-A5-16 sai loại file → 400, kể cả file chữ đặt tên .png và khai Content-Type image/png", async () => {
				const a = (await createActivity({}).expect(201)).body as Json;
				await upload(a.id, IMAGES.gif).expect(400);
				await upload(a.id, { buffer: Buffer.from("day khong phai anh"), filename: "anh.png", contentType: "image/png" }).expect(400);
				await upload(a.id, { buffer: Buffer.alloc(0), filename: "rong.png", contentType: "image/png" }).expect(400);
			});

			it("E2E-A5-17 không gửi field file → 400", async () => {
				const a = (await createActivity({}).expect(201)).body as Json;
				await http().post(`/activities/${a.id}/images`, w.teacherA).field("note", "x").expect(400);
			});

			it("E2E-A5-18 ảnh lớn hơn 2 MB → 413", async () => {
				const a = (await createActivity({}).expect(201)).body as Json;
				const big = Buffer.concat([IMAGES.png.buffer, Buffer.alloc(2 * 1024 * 1024)]);
				await upload(a.id, { ...IMAGES.png, buffer: big }).expect(413);
			});

			it("E2E-A5-19 tối đa 6 ảnh mỗi hoạt động, ảnh thứ 7 → 409", async () => {
				const a = (await createActivity({}).expect(201)).body as Json;
				for (let i = 0; i < 6; i++) await upload(a.id, IMAGES.png).expect(201);
				await upload(a.id, IMAGES.png).expect(409);
			});

			it("E2E-A5-20 giáo viên lớp khác, phụ huynh → 403; hoạt động không tồn tại → 404", async () => {
				const a = (await createActivity({}).expect(201)).body as Json;
				await upload(a.id, IMAGES.png, "teacherB").expect(403);
				await upload(a.id, IMAGES.png, "parentA").expect(403);
				await upload(randomUUID(), IMAGES.png).expect(404);
			});
		});

		describe("hoạt động của một trẻ", () => {
			it("E2E-A5-21 phụ huynh thấy hoạt động con đã tham gia, có số trẻ tham gia, không có tên trẻ khác", async () => {
				const both = (await createActivity({ title: "Cả hai", participants: joined(w.an.id, w.binh.id) }).expect(201)).body as Json;
				await createActivity({ title: "Chỉ Bình", participants: joined(w.binh.id) }).expect(201);
				const skipped = (await createActivity({ title: "An không tham gia", participants: joined(w.an.id) }).expect(201)).body as Json;
				await http().post(`/activities/${skipped.id}/participants`, w.teacherA).send({ participants: [{ childId: w.an.id, participationStatus: "NOT_JOINED" }] }).expect(200);
				await upload(both.id, IMAGES.png).expect(201);

				const res = await http().get(`/children/${w.an.id}/activities`, w.parentA).expect(200);
				expect(res.body.pageInfo.totalItems).toBe(1);
				expect(res.body.items[0]).toMatchObject({ id: both.id, title: "Cả hai", participantCount: 2 });
				expect(res.body.items[0].images).toHaveLength(1);
				expect(res.body.items[0]).not.toHaveProperty("participants");
				expect(JSON.stringify(res.body)).not.toContain("Bình");
			});

			it.each(["teacherA", "manager"] as const)("E2E-A5-22 %s xem được hoạt động của bé An", async (who) => {
				await createActivity({ participants: joined(w.an.id) }).expect(201);
				expect((await http().get(`/children/${w.an.id}/activities`, as(who)).expect(200)).body.items).toHaveLength(1);
			});

			it.each(["parentB", "teacherB", "medical", "admin"] as const)("E2E-A5-23 %s không xem được hoạt động của bé An → 403", async (who) => {
				await http().get(`/children/${w.an.id}/activities`, as(who)).expect(403);
			});

			it("E2E-A5-24 trẻ không tồn tại → 404", async () => {
				await http().get(`/children/${randomUUID()}/activities`, w.manager).expect(404);
			});
		});

		it("E2E-A5-25 tạo hoạt động và tải ảnh đều có audit", async () => {
			const count = async () => Number((await dataSource.query("SELECT count(*)::int AS n FROM audit_logs"))[0].n);
			const before = await count();
			const a = (await createActivity({ participants: joined(w.an.id) }).expect(201)).body as Json;
			await upload(a.id, IMAGES.png).expect(201);
			expect(await count()).toBeGreaterThanOrEqual(before + 2);
		});

		it("E2E-A5-26 mọi phản hồi thành công khớp schema trong openapi.yaml", async () => {
			const created = await createActivity({ participants: joined(w.an.id) });
			expectSchema("/activities", "post", created);
			expectSchema("/activities/{activityId}/images", "post", await upload(created.body.id, IMAGES.png));
			expectSchema("/activities/{activityId}/participants", "post", await http().post(`/activities/${created.body.id}/participants`, w.teacherA).send({ participants: joined(w.binh.id) }));
			expectSchema("/activities", "get", await http().get("/activities", w.manager));
			expectSchema("/children/{childId}/activities", "get", await http().get(`/children/${w.an.id}/activities`, w.parentA));
		});
	});

	/* ===================================================== UC-11, UC-12 đón trẻ */
	describeWhen(PICKUPS, "STAGE5_E2E")("UC-11, UC-12 đón trẻ", () => {
		// Hôm nay 23:59 giờ Việt Nam: luôn ở tương lai khi test chạy, và vẫn là "hôm nay" để hoàn tất được
		const tonight = () => `${today()}T23:59:00+07:00`;
		const valid = (): Json => ({ childId: w.an.id, pickupPerson: "Trần Văn Bình", relationship: "Chú", idNumber: ID_NUMBER, phone: PHONE, expectedTime: tonight() });
		const create = (patch: Json = {}, who: Who = "parentA") => http().post("/pickup-requests", as(who)).send({ ...valid(), ...patch });
		const created = async (patch: Json = {}, who: Who = "parentA") => (await create(patch, who).expect(201)).body as Json;
		const act = (id: string, action: "cancel" | "approve" | "reject" | "complete", who: Who, body: Json = {}) =>
			http().patch(`/pickup-requests/${id}/${action}`, as(who)).send(body);
		const checkIn = (childId = w.an.id) => http().post("/attendance/check-in", w.teacherA).send({ childId }).expect(201);
		const attendanceToday = async (childId = w.an.id) => (await http().get(`/children/${childId}/attendance/today`, w.parentA).expect(200)).body as Json;

		describe("đăng ký người đón", () => {
			it("E2E-P5-01 phụ huynh đăng ký → 201 PENDING; tên được trim, số điện thoại bỏ dấu cách, số giấy tờ bị che", async () => {
				const res = await create({ pickupPerson: "  Trần Văn Bình  " }).expect(201);
				expect(res.body).toMatchObject({ childId: w.an.id, requesterUserId: w.parentA.id, pickupPerson: "Trần Văn Bình", relationship: "Chú", phone: "0912345678", status: "PENDING", verifiedByTeacherUserId: null, decisionReason: null, completedAt: null });
				expect(Date.parse(res.body.expectedTime)).toBe(Date.parse(tonight()));
				expect(res.body.idNumber).not.toBe(ID_NUMBER);
				expect(res.body.idNumber.endsWith("4567")).toBe(true);
				expect(res.body.idNumber).not.toContain("00120300");
			});

			it("E2E-P5-02 CMND 9 số hợp lệ; không có số điện thoại thì phone = null", async () => {
				const res = await create({ idNumber: "123456789", phone: undefined }).expect(201);
				expect(res.body.phone).toBeNull();
			});

			it.each([
				["thiếu tên người đón", { pickupPerson: undefined }],
				["tên toàn dấu cách", { pickupPerson: "   " }],
				["tên quá 150 ký tự", { pickupPerson: "a".repeat(151) }],
				["thiếu quan hệ", { relationship: undefined }],
				["quan hệ rỗng", { relationship: "" }],
				["quan hệ quá 50 ký tự", { relationship: "a".repeat(51) }],
				["thiếu số giấy tờ", { idNumber: undefined }],
				["giấy tờ 8 số", { idNumber: "12345678" }],
				["giấy tờ 10 số", { idNumber: "1234567890" }],
				["giấy tờ có chữ", { idNumber: "00120300456A" }],
				["số điện thoại có chữ", { phone: "09123abc45" }],
				["số điện thoại quá ngắn", { phone: "0912" }],
				["thiếu thời gian đón", { expectedTime: undefined }],
				["thời gian sai định dạng", { expectedTime: "chiều nay" }],
				["thời gian ở quá khứ", { expectedTime: "PAST" }],
				["childId không phải UUID", { childId: "abc" }],
				["trường lạ", { note: "Đón sớm" }],
			])("E2E-P5-03 %s → 400", async (_label, patch) => {
				const body: Json = { ...patch };
				if (body.expectedTime === "PAST") body.expectedTime = new Date(Date.now() - 3_600_000).toISOString();
				await create(body).expect(400);
			});

			it("E2E-P5-04 phụ huynh khác → 403; trẻ không tồn tại → 404; trẻ đã nghỉ học → 409", async () => {
				await create({}, "parentB").expect(403);
				await create({ childId: randomUUID() }).expect(404);
				await create({ childId: w.withdrawn.id }).expect(409);
			});

			it.each(["teacherA", "manager", "medical", "admin"] as const)("E2E-P5-05 %s không đăng ký được → 403", async (who) => {
				await create({}, who).expect(403);
			});

			it("E2E-P5-06 chưa đăng nhập → 401", async () => {
				await http().post("/pickup-requests").send({ childId: w.an.id }).expect(401);
			});
		});

		describe("danh sách yêu cầu", () => {
			it("E2E-P5-07 phụ huynh chỉ thấy yêu cầu mình tạo; giáo viên chỉ thấy lớp mình", async () => {
				const an = await created();
				const binh = await created({ childId: w.binh.id }, "parentB");
				const chi = await created({ childId: w.chi.id }, "parentB");
				const ids = async (who: Who) => sorted(((await http().get("/pickup-requests", as(who)).expect(200)).body.items as Json[]).map((p) => p.id));
				expect(await ids("parentA")).toEqual([an.id]);
				expect(await ids("parentB")).toEqual(sorted([binh.id, chi.id]));
				expect(await ids("teacherA")).toEqual(sorted([an.id, binh.id]));
				expect(await ids("teacherB")).toEqual([chi.id]);
			});

			it("E2E-P5-08 giáo viên của lớp thấy đủ số giấy tờ; phụ huynh chỉ thấy 4 số cuối", async () => {
				await created();
				expect((await http().get("/pickup-requests", w.teacherA).expect(200)).body.items[0].idNumber).toBe(ID_NUMBER);
				const own = (await http().get("/pickup-requests", w.parentA).expect(200)).body.items[0];
				expect(own.idNumber).not.toBe(ID_NUMBER);
				expect(own.idNumber.endsWith("4567")).toBe(true);
			});

			it("E2E-P5-09 lọc theo trạng thái, ngày; giờ đón sớm nhất trước; có phân trang", async () => {
				const tomorrow = addDays(today(), 1);
				const late = await created({ expectedTime: `${tomorrow}T17:00:00+07:00` });
				const early = await created({ expectedTime: `${tomorrow}T16:00:00+07:00` });
				const tonightReq = await created();
				await act(tonightReq.id, "approve", "teacherA").expect(200);
				const list = async (q: string) => ((await http().get(`/pickup-requests${q}`, w.teacherA).expect(200)).body.items as Json[]).map((p) => p.id);
				expect(await list(`?date=${tomorrow}`)).toEqual([early.id, late.id]);
				expect(await list("?status=APPROVED")).toEqual([tonightReq.id]);
				expect(await list("")).toEqual([tonightReq.id, early.id, late.id]);
				const page = await http().get("/pickup-requests?limit=2&page=2", w.teacherA).expect(200);
				expect(page.body.pageInfo).toEqual({ page: 2, limit: 2, totalItems: 3, totalPages: 2 });
				expect((page.body.items as Json[]).map((p) => p.id)).toEqual([late.id]);
			});

			it("E2E-P5-10 giáo viên lọc lớp không phụ trách → 403; trạng thái lạ → 400; quản lý, y tế, quản trị → 403", async () => {
				await http().get(`/pickup-requests?classId=${w.classB.id}`, w.teacherA).expect(403);
				await http().get("/pickup-requests?status=DONE", w.teacherA).expect(400);
				for (const who of ["manager", "medical", "admin"] as const) await http().get("/pickup-requests", as(who)).expect(403);
			});
		});

		describe("hủy, duyệt, từ chối", () => {
			it("E2E-P5-11 phụ huynh hủy yêu cầu PENDING → 200 CANCELLED; hủy lần hai → 409", async () => {
				const p = await created();
				expect((await act(p.id, "cancel", "parentA").expect(200)).body.status).toBe("CANCELLED");
				await act(p.id, "cancel", "parentA").expect(409);
			});

			it("E2E-P5-12 hủy yêu cầu của phụ huynh khác → 404; giáo viên hủy → 403; không tồn tại → 404", async () => {
				const p = await created();
				await act(p.id, "cancel", "parentB").expect(404);
				await act(p.id, "cancel", "teacherA").expect(403);
				await act(randomUUID(), "cancel", "parentA").expect(404);
			});

			it("E2E-P5-13 giáo viên của lớp duyệt → 200 APPROVED, ghi người duyệt; duyệt lại → 409; phụ huynh không hủy được nữa → 409", async () => {
				const p = await created();
				const res = await act(p.id, "approve", "teacherA").expect(200);
				expect(res.body).toMatchObject({ status: "APPROVED", verifiedByTeacherUserId: w.teacherA.id });
				expect(res.body.decidedAt).toEqual(expect.any(String));
				await act(p.id, "approve", "teacherA").expect(409);
				await act(p.id, "cancel", "parentA").expect(409);
			});

			it("E2E-P5-14 từ chối cần lý do 1-500 ký tự sau khi trim; từ chối xong thì không duyệt được", async () => {
				const p = await created();
				await act(p.id, "reject", "teacherA", {}).expect(400);
				await act(p.id, "reject", "teacherA", { reason: "   " }).expect(400);
				await act(p.id, "reject", "teacherA", { reason: "a".repeat(501) }).expect(400);
				const res = await act(p.id, "reject", "teacherA", { reason: "  Không khớp giấy tờ  " }).expect(200);
				expect(res.body).toMatchObject({ status: "REJECTED", decisionReason: "Không khớp giấy tờ", verifiedByTeacherUserId: w.teacherA.id });
				await act(p.id, "approve", "teacherA").expect(409);
			});

			it.each([
				["approve", {}],
				["reject", { reason: "x" }],
			] as const)("E2E-P5-15 %s: giáo viên lớp khác, phụ huynh → 403; không tồn tại → 404", async (action, body) => {
				const p = await created();
				await act(p.id, action, "teacherB", body).expect(403);
				await act(p.id, action, "parentA", body).expect(403);
				await act(randomUUID(), action, "teacherA", body).expect(404);
			});
		});

		describe("hoàn tất giao trẻ", () => {
			it("E2E-P5-16 trẻ đã check-in, yêu cầu đã duyệt hôm nay → 200 COMPLETED và trẻ được check-out", async () => {
				await checkIn();
				const p = await created();
				await act(p.id, "approve", "teacherA").expect(200);
				const res = await act(p.id, "complete", "teacherA").expect(200);
				expect(res.body.status).toBe("COMPLETED");
				expect(res.body.completedAt).toEqual(expect.any(String));
				expect((await attendanceToday()).checkOutTime).not.toBeNull();
			});

			it("E2E-P5-17 hoàn tất lần hai → 409, giờ check-out không đổi", async () => {
				await checkIn();
				const p = await created();
				await act(p.id, "approve", "teacherA").expect(200);
				await act(p.id, "complete", "teacherA").expect(200);
				const first = (await attendanceToday()).checkOutTime;
				await act(p.id, "complete", "teacherA").expect(409);
				expect((await attendanceToday()).checkOutTime).toBe(first);
			});

			it.each([
				["PENDING", async (_id: string) => {}],
				["REJECTED", async (id: string) => { await act(id, "reject", "teacherA", { reason: "x" }).expect(200); }],
				["CANCELLED", async (id: string) => { await act(id, "cancel", "parentA").expect(200); }],
			])("E2E-P5-18 yêu cầu %s → 409, trẻ không bị check-out", async (_status, prepare) => {
				await checkIn();
				const p = await created();
				await prepare(p.id);
				await act(p.id, "complete", "teacherA").expect(409);
				expect((await attendanceToday()).checkOutTime).toBeNull();
			});

			it("E2E-P5-19 trẻ chưa check-in → 409, yêu cầu vẫn APPROVED", async () => {
				const p = await created();
				await act(p.id, "approve", "teacherA").expect(200);
				await act(p.id, "complete", "teacherA").expect(409);
				const after = (await http().get("/pickup-requests", w.teacherA).expect(200)).body.items[0];
				expect(after.status).toBe("APPROVED");
			});

			it("E2E-P5-20 trẻ đã được check-out trước đó → 409, yêu cầu vẫn APPROVED", async () => {
				await checkIn();
				await http().post("/attendance/check-out", w.teacherA).send({ childId: w.an.id }).expect(200);
				const p = await created();
				await act(p.id, "approve", "teacherA").expect(200);
				await act(p.id, "complete", "teacherA").expect(409);
				expect((await http().get("/pickup-requests", w.teacherA).expect(200)).body.items[0].status).toBe("APPROVED");
			});

			it("E2E-P5-21 yêu cầu của ngày mai → 409", async () => {
				await checkIn();
				const p = await created({ expectedTime: `${addDays(today(), 1)}T16:00:00+07:00` });
				await act(p.id, "approve", "teacherA").expect(200);
				await act(p.id, "complete", "teacherA").expect(409);
			});

			it("E2E-P5-22 hai giáo viên bấm hoàn tất cùng lúc → đúng một request thành công", async () => {
				await checkIn();
				const p = await created();
				await act(p.id, "approve", "teacherA").expect(200);
				const results = await Promise.all([act(p.id, "complete", "teacherA"), act(p.id, "complete", "teacherA")]);
				expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 409]);
				expect((await attendanceToday()).checkOutTime).not.toBeNull();
			});

			it("E2E-P5-23 giáo viên lớp khác, phụ huynh → 403; không tồn tại → 404", async () => {
				await checkIn();
				const p = await created();
				await act(p.id, "approve", "teacherA").expect(200);
				await act(p.id, "complete", "teacherB").expect(403);
				await act(p.id, "complete", "parentA").expect(403);
				await act(randomUUID(), "complete", "teacherA").expect(404);
			});
		});

		it("E2E-P5-24 mọi thao tác đều có audit, nhưng audit không chứa số giấy tờ hay số điện thoại", async () => {
			const count = async () => Number((await dataSource.query("SELECT count(*)::int AS n FROM audit_logs"))[0].n);
			await checkIn();
			const before = await count();
			const a = await created();
			await act(a.id, "approve", "teacherA").expect(200);
			await act(a.id, "complete", "teacherA").expect(200);
			const b = await created();
			await act(b.id, "reject", "teacherA", { reason: "x" }).expect(200);
			const c = await created();
			await act(c.id, "cancel", "parentA").expect(200);
			expect(await count()).toBeGreaterThanOrEqual(before + 7);
			const logs = JSON.stringify(await dataSource.query("SELECT * FROM audit_logs"));
			for (const secret of [ID_NUMBER, PHONE, PHONE.replace(/\s/g, "")]) expect(logs).not.toContain(secret);
		});

		it("E2E-P5-25 mọi phản hồi thành công khớp schema trong openapi.yaml", async () => {
			await checkIn();
			const res = await create();
			expectSchema("/pickup-requests", "post", res);
			expectSchema("/pickup-requests", "get", await http().get("/pickup-requests", w.parentA));
			expectSchema("/pickup-requests", "get", await http().get("/pickup-requests", w.teacherA));
			expectSchema("/pickup-requests/{requestId}/approve", "patch", await act(res.body.id, "approve", "teacherA"));
			expectSchema("/pickup-requests/{requestId}/complete", "patch", await act(res.body.id, "complete", "teacherA"));
			expectSchema("/pickup-requests/{requestId}/reject", "patch", await act((await created()).id, "reject", "teacherA", { reason: "x" }));
			expectSchema("/pickup-requests/{requestId}/cancel", "patch", await act((await created()).id, "cancel", "parentA"));
		});
	});
});
