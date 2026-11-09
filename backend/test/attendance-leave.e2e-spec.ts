import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AuditLogsService } from "../src/audit-logs/audit-logs.service";
import { DomainEventPublisher } from "../src/common/domain-events/domain-event.publisher";
import { addDays, todayInSchool } from "../src/common/school-time";
import { api, createTestApp, resetDatabase, seedWorld } from "./helpers/test-app";
import type { World } from "./helpers/test-app";

// Ngày cố định trong quá khứ (thứ Hai) để kết quả không phụ thuộc giờ chạy test.
const PAST = "2026-01-05";
const iso = (date: string, hhmm: string) => `${date}T${hhmm}:00+07:00`;

describe("Stage 3 — điểm danh và đơn nghỉ (UC-06, UC-07, UC-08)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let w: World;
	let events: DomainEventPublisher;

	const http = () => api(app);
	const count = async (table: string) => Number((await dataSource.query(`SELECT count(*)::int AS n FROM ${table}`))[0].n);

	beforeAll(async () => {
		({ app, dataSource } = await createTestApp());
		events = app.get(DomainEventPublisher, { strict: false });
	});
	afterAll(async () => { await app.close(); });
	beforeEach(async () => {
		await resetDatabase(dataSource);
		w = await seedWorld(dataSource);
	});
	afterEach(() => jest.restoreAllMocks());

	/* ===================================================== UC-06 điểm danh */
	describe("bảng điểm danh của lớp", () => {
		it("giáo viên của lớp thấy trẻ đang học (không gồm trẻ đã nghỉ), chưa điểm danh, kèm giờ chuẩn", async () => {
			const res = await http().get(`/classes/${w.classA.id}/attendance?date=${PAST}`, w.teacherA).expect(200);
			expect(res.body.className).toBe("Mầm 1");
			expect(res.body.settings).toEqual({ startTime: "08:00", endTime: "16:00" });
			expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(["An", "Bình"]);
			expect(res.body.items.every((i: { status: string; attendanceId: unknown }) => i.status === "NOT_CHECKED_IN" && i.attendanceId === null)).toBe(true);
		});

		it("quản lý xem được; giáo viên lớp khác, phụ huynh, y tế bị chặn; chưa đăng nhập nhận 401", async () => {
			await http().get(`/classes/${w.classA.id}/attendance`, w.manager).expect(200);
			const other = await http().get(`/classes/${w.classA.id}/attendance`, w.teacherB).expect(403);
			expect(other.body.code).toBe("CLASS_ACCESS_DENIED");
			expect((await http().get(`/classes/${w.classA.id}/attendance`, w.parentA).expect(403)).body.code).toBe("ROLE_NOT_ALLOWED");
			await http().get(`/classes/${w.classA.id}/attendance`, w.medical).expect(403);
			await http().get(`/classes/${w.classA.id}/attendance`).expect(401);
		});

		it("id lớp sai định dạng nhận 400; lớp không tồn tại nhận 404; ngày không có thật nhận 400", async () => {
			await http().get("/classes/not-a-uuid/attendance", w.manager).expect(400);
			await http().get("/classes/7b1f1e0e-0000-4000-8000-000000000000/attendance", w.manager).expect(404);
			await http().get(`/classes/${w.classA.id}/attendance?date=2026-02-30`, w.manager).expect(400);
		});
	});

	describe("check-in", () => {
		const checkIn = (body: object, as: { id: string } = w.teacherA) => http().post("/attendance/check-in", as).send(body);

		it("hôm nay không gửi giờ: dùng giờ hiện tại, trạng thái do server tính", async () => {
			const before = Date.now();
			const res = await checkIn({ childId: w.an.id }).expect(201);
			expect(res.body.date).toBe(todayInSchool());
			expect(["PRESENT", "LATE"]).toContain(res.body.status);
			expect(Math.abs(new Date(res.body.checkInTime).getTime() - before)).toBeLessThan(60_000);
			expect(res.body.recordedByUserId).toBe(w.teacherA.id);
			expect(res.body).not.toHaveProperty("child");
		});

		it("sát biên giờ chuẩn: 08:00 đúng giờ, 08:01 muộn", async () => {
			const onTime = await checkIn({ childId: w.an.id, checkInTime: iso(PAST, "08:00") }).expect(201);
			const late = await checkIn({ childId: w.binh.id, checkInTime: iso(PAST, "08:01") }).expect(201);
			expect(onTime.body.status).toBe("PRESENT");
			expect(late.body.status).toBe("LATE");
			expect(onTime.body.date).toBe(PAST);
		});

		it("ghi vắng bằng status = ABSENT, không có giờ đến", async () => {
			const res = await checkIn({ childId: w.an.id, date: PAST, status: "ABSENT" }).expect(201);
			expect(res.body).toMatchObject({ status: "ABSENT", checkInTime: null, checkOutTime: null, earlyLeave: false });
			await checkIn({ childId: w.binh.id, date: PAST, status: "ABSENT", checkInTime: iso(PAST, "08:00") }).expect(400);
		});

		it("trùng (trẻ, ngày) bị 409", async () => {
			await checkIn({ childId: w.an.id, checkInTime: iso(PAST, "07:50") }).expect(201);
			const dup = await checkIn({ childId: w.an.id, checkInTime: iso(PAST, "07:55") }).expect(409);
			expect(dup.body.code).toBe("ATTENDANCE_EXISTS");
			expect(await count("attendance")).toBe(1);
		});

		it("hai giáo viên bấm cùng lúc: đúng một bản ghi, bên còn lại nhận 409 (không phải 500)", async () => {
			const body = { childId: w.an.id, checkInTime: iso(PAST, "07:50") };
			const results = await Promise.all(Array.from({ length: 6 }, () => checkIn(body)));
			const statuses = results.map((r) => r.status).sort();
			expect(statuses.filter((s) => s === 201)).toHaveLength(1);
			expect(statuses.filter((s) => s === 409)).toHaveLength(5);
			expect(await count("attendance")).toBe(1);
		});

		it("từ chối: ngày tương lai, giờ tương lai, giờ lệch ngày, ngày đã qua thiếu giờ, định dạng sai", async () => {
			const tomorrow = addDays(todayInSchool(), 1);
			expect((await checkIn({ childId: w.an.id, date: tomorrow }).expect(400)).body.field).toBe("date");
			await checkIn({ childId: w.an.id, checkInTime: new Date(Date.now() + 2 * 3_600_000).toISOString() }).expect(400);
			expect((await checkIn({ childId: w.an.id, date: PAST, checkInTime: iso("2026-01-06", "08:00") }).expect(400)).body.field).toBe("checkInTime");
			expect((await checkIn({ childId: w.an.id, date: PAST }).expect(400)).body.field).toBe("checkInTime");
			await checkIn({ childId: w.an.id, checkInTime: "08:00" }).expect(400);
			await checkIn({ childId: "not-a-uuid" }).expect(400);
			await checkIn({ childId: w.an.id, unexpected: true }).expect(400);
			expect(await count("attendance")).toBe(0);
		});

		it("chặn: giáo viên lớp khác, phụ huynh, y tế; trẻ không tồn tại; trẻ đã nghỉ học", async () => {
			expect((await checkIn({ childId: w.an.id, date: PAST, status: "ABSENT" }, w.teacherB).expect(403)).body.code).toBe("CLASS_ACCESS_DENIED");
			await checkIn({ childId: w.an.id }, w.parentA).expect(403);
			await checkIn({ childId: w.an.id }, w.medical).expect(403);
			await http().post("/attendance/check-in").send({ childId: w.an.id }).expect(401);
			await checkIn({ childId: "7b1f1e0e-0000-4000-8000-000000000000" }).expect(404);
			expect((await checkIn({ childId: w.withdrawn.id, date: PAST, status: "ABSENT" }).expect(409)).body.code).toBe("CHILD_NOT_ACTIVE");
			expect(await count("attendance")).toBe(0);
		});

		it("quản lý điểm danh được cho mọi lớp", async () => {
			await checkIn({ childId: w.chi.id, checkInTime: iso(PAST, "07:40") }, w.manager).expect(201);
		});

		it("ghi audit log người thao tác, hành động và đối tượng", async () => {
			const res = await checkIn({ childId: w.an.id, checkInTime: iso(PAST, "07:50") }).expect(201);
			const rows = await dataSource.query(`SELECT * FROM audit_logs WHERE action = 'CHECK_IN'`);
			expect(rows).toHaveLength(1);
			expect(rows[0]).toMatchObject({ actor_user_id: w.teacherA.id, resource_type: "attendance", resource_id: res.body.id });
		});
	});

	describe("check-out", () => {
		const checkIn = (childId: string, time: string, date = PAST) => http().post("/attendance/check-in", w.teacherA).send({ childId, checkInTime: iso(date, time) });
		const checkOut = (body: object, as: { id: string } = w.teacherA) => http().post("/attendance/check-out", as).send(body);

		it("check-out trước khi check-in bị 409", async () => {
			const res = await checkOut({ childId: w.an.id, date: PAST, checkOutTime: iso(PAST, "16:30") }).expect(409);
			expect(res.body.code).toBe("NOT_CHECKED_IN");
		});

		it("check-out hợp lệ; về trước giờ tan học thì earlyLeave = true", async () => {
			await checkIn(w.an.id, "07:50").expect(201);
			await checkIn(w.binh.id, "07:50").expect(201);
			const ok = await checkOut({ childId: w.an.id, date: PAST, checkOutTime: iso(PAST, "16:30") }).expect(200);
			const early = await checkOut({ childId: w.binh.id, date: PAST, checkOutTime: iso(PAST, "15:00") }).expect(200);
			expect(ok.body.earlyLeave).toBe(false);
			expect(early.body.earlyLeave).toBe(true);
			expect(new Date(ok.body.checkOutTime).toISOString()).toBe(new Date(iso(PAST, "16:30")).toISOString());
		});

		it("check-out lần hai bị 409; giờ về trước giờ đến bị 400", async () => {
			await checkIn(w.an.id, "08:30").expect(201);
			const before = await checkOut({ childId: w.an.id, date: PAST, checkOutTime: iso(PAST, "08:00") }).expect(400);
			expect(before.body.field).toBe("checkOutTime");
			await checkOut({ childId: w.an.id, date: PAST, checkOutTime: iso(PAST, "16:00") }).expect(200);
			expect((await checkOut({ childId: w.an.id, date: PAST, checkOutTime: iso(PAST, "16:10") }).expect(409)).body.code).toBe("ALREADY_CHECKED_OUT");
		});

		it("hai check-out cùng lúc: đúng một lần thành công", async () => {
			await checkIn(w.an.id, "07:50").expect(201);
			const body = { childId: w.an.id, date: PAST, checkOutTime: iso(PAST, "16:00") };
			const results = await Promise.all(Array.from({ length: 5 }, () => checkOut(body)));
			expect(results.filter((r) => r.status === 200)).toHaveLength(1);
			expect(results.filter((r) => r.status === 409)).toHaveLength(4);
			expect(await count("audit_logs WHERE action = 'CHECK_OUT'")).toBe(1);
		});

		it("trẻ ghi vắng không check-out được; giáo viên lớp khác bị 403; giờ tương lai bị 400", async () => {
			await http().post("/attendance/check-in", w.teacherA).send({ childId: w.an.id, date: PAST, status: "ABSENT" }).expect(201);
			expect((await checkOut({ childId: w.an.id, date: PAST, checkOutTime: iso(PAST, "16:00") }).expect(409)).body.code).toBe("NOT_CHECKED_IN");
			await checkIn(w.binh.id, "07:50").expect(201);
			await checkOut({ childId: w.binh.id, date: PAST, checkOutTime: iso(PAST, "16:00") }, w.teacherB).expect(403);
			await checkOut({ childId: w.binh.id, checkOutTime: new Date(Date.now() + 3 * 3_600_000).toISOString() }).expect(400);
		});
	});

	describe("sửa điểm danh", () => {
		const create = async (time: string, childId = w.an.id) =>
			(await http().post("/attendance/check-in", w.teacherA).send({ childId, checkInTime: iso(PAST, time) }).expect(201)).body;
		const patch = (id: string, body: object, as: { id: string } = w.teacherA) => http().patch(`/attendance/${id}`, as).send(body);

		it("đổi giờ đến tính lại trạng thái và ghi audit giá trị trước/sau", async () => {
			const rec = await create("07:50");
			const res = await patch(rec.id, { checkInTime: iso(PAST, "08:20") }).expect(200);
			expect(res.body.status).toBe("LATE");
			const [log] = await dataSource.query(`SELECT old_value, new_value FROM audit_logs WHERE action = 'UPDATE_ATTENDANCE'`);
			expect(log.old_value.status).toBe("PRESENT");
			expect(log.new_value.status).toBe("LATE");
		});

		it("chuyển sang ABSENT xóa giờ; không thể ABSENT kèm giờ; body rỗng bị 400", async () => {
			const rec = await create("07:50");
			await patch(rec.id, { status: "ABSENT", checkInTime: iso(PAST, "08:00") }).expect(400);
			const res = await patch(rec.id, { status: "ABSENT" }).expect(200);
			expect(res.body).toMatchObject({ status: "ABSENT", checkInTime: null, checkOutTime: null });
			await patch(rec.id, {}).expect(400);
		});

		it("chuyển từ vắng về có mặt cần giờ đến; xóa giờ về bằng null", async () => {
			const rec = await create("07:50");
			await http().post("/attendance/check-out", w.teacherA).send({ childId: w.an.id, date: PAST, checkOutTime: iso(PAST, "16:00") }).expect(200);
			const cleared = await patch(rec.id, { checkOutTime: null }).expect(200);
			expect(cleared.body.checkOutTime).toBeNull();
			await patch(rec.id, { status: "ABSENT" }).expect(200);
			expect((await patch(rec.id, { status: "PRESENT" }).expect(400)).body.field).toBe("checkInTime");
			const back = await patch(rec.id, { status: "PRESENT", checkInTime: iso(PAST, "07:45") }).expect(200);
			expect(back.body.status).toBe("PRESENT");
		});

		it("giáo viên lớp khác, phụ huynh bị chặn; bản ghi không tồn tại nhận 404", async () => {
			const rec = await create("07:50");
			await patch(rec.id, { status: "ABSENT" }, w.teacherB).expect(403);
			await patch(rec.id, { status: "ABSENT" }, w.parentA).expect(403);
			await patch("7b1f1e0e-0000-4000-8000-000000000000", { status: "ABSENT" }).expect(404);
		});
	});

	/* ================================================= UC-07 phụ huynh */
	describe("UC-07: phụ huynh xem tình hình của con", () => {
		const record = (childId: string, date: string, time: string) =>
			http().post("/attendance/check-in", w.teacherA).send({ childId, checkInTime: iso(date, time) }).expect(201);

		it("hôm nay: phụ huynh đã liên kết thấy trạng thái; chưa điểm danh hiện NOT_CHECKED_IN", async () => {
			const none = await http().get(`/children/${w.an.id}/attendance/today`, w.parentA).expect(200);
			expect(none.body).toMatchObject({ status: "NOT_CHECKED_IN", checkInTime: null, onLeave: false, date: todayInSchool() });
			await http().post("/attendance/check-in", w.teacherA).send({ childId: w.an.id }).expect(201);
			const after = await http().get(`/children/${w.an.id}/attendance/today`, w.parentA).expect(200);
			expect(["PRESENT", "LATE"]).toContain(after.body.status);
			expect(after.body.checkInTime).toEqual(expect.any(String));
		});

		it("IDOR: phụ huynh B đổi id sang con của phụ huynh A bị 403 ở mọi API UC-07", async () => {
			for (const path of [`/children/${w.an.id}/attendance/today`, `/children/${w.an.id}/attendance`]) {
				const res = await http().get(path, w.parentB).expect(403);
				expect(res.body.code).toBe("CHILD_ACCESS_DENIED");
				expect(JSON.stringify(res.body)).not.toContain("An");
			}
		});

		it("giáo viên chỉ xem trẻ của lớp mình; quản lý xem tất cả; y tế và admin không xem điểm danh", async () => {
			await http().get(`/children/${w.an.id}/attendance/today`, w.teacherA).expect(200);
			await http().get(`/children/${w.an.id}/attendance/today`, w.teacherB).expect(403);
			await http().get(`/children/${w.an.id}/attendance/today`, w.manager).expect(200);
			await http().get(`/children/${w.an.id}/attendance/today`, w.medical).expect(403);
			await http().get(`/children/${w.an.id}/attendance/today`, w.admin).expect(403);
			await http().get(`/children/${w.an.id}/attendance/today`).expect(401);
			await http().get("/children/7b1f1e0e-0000-4000-8000-000000000000/attendance/today", w.manager).expect(404);
		});

		it("lịch sử: mới nhất trước, phân trang, lọc theo khoảng ngày", async () => {
			for (let d = 5; d <= 9; d += 1) await record(w.an.id, `2026-01-0${d}`, "07:50");
			const page1 = await http().get(`/children/${w.an.id}/attendance?limit=2&page=1`, w.parentA).expect(200);
			expect(page1.body.items.map((i: { date: string }) => i.date)).toEqual(["2026-01-09", "2026-01-08"]);
			expect(page1.body.pageInfo).toEqual({ page: 1, limit: 2, totalItems: 5, totalPages: 3 });
			const page3 = await http().get(`/children/${w.an.id}/attendance?limit=2&page=3`, w.parentA).expect(200);
			expect(page3.body.items.map((i: { date: string }) => i.date)).toEqual(["2026-01-05"]);
			const range = await http().get(`/children/${w.an.id}/attendance?from=2026-01-06&to=2026-01-07`, w.parentA).expect(200);
			expect(range.body.items).toHaveLength(2);
			expect(range.body.items[0]).not.toHaveProperty("recordedBy");
		});

		it("lịch sử: khoảng ngày đảo ngược, ngày sai, limit vượt trần bị 400", async () => {
			await http().get(`/children/${w.an.id}/attendance?from=2026-02-01&to=2026-01-01`, w.parentA).expect(400);
			await http().get(`/children/${w.an.id}/attendance?from=2026-02-30`, w.parentA).expect(400);
			await http().get(`/children/${w.an.id}/attendance?limit=1000`, w.parentA).expect(400);
			await http().get(`/children/${w.an.id}/attendance?page=0`, w.parentA).expect(400);
		});
	});

	/* ====================================================== UC-08 đơn nghỉ */
	describe("UC-08: đơn xin nghỉ", () => {
		const today = () => todayInSchool();
		const d = (n: number) => addDays(today(), n);
		const create = (body: object, as: { id: string } = w.parentA) => http().post("/leave-requests", as).send(body);
		const valid = (over: object = {}) => ({ childId: w.an.id, fromDate: d(1), toDate: d(3), reason: "Bé bị cảm", ...over });

		it("phụ huynh gửi đơn cho con mình: PENDING, kèm tên trẻ, lớp, phụ huynh", async () => {
			const res = await create(valid()).expect(201);
			expect(res.body).toMatchObject({
				status: "PENDING", childName: "An", className: "Mầm 1", parentName: "Phụ Huynh A", parentUserId: w.parentA.id,
				decidedByUserId: null, decisionReason: null,
			});
			const [log] = await dataSource.query(`SELECT * FROM audit_logs WHERE action = 'CREATE_LEAVE_REQUEST'`);
			expect(log.actor_user_id).toBe(w.parentA.id);
		});

		it("từ chối: ngày quá khứ, đảo ngược, ngày không có thật, quá dài, thiếu lý do, trẻ đã nghỉ học", async () => {
			expect((await create(valid({ fromDate: d(-1), toDate: d(1) })).expect(400)).body.field).toBe("fromDate");
			expect((await create(valid({ fromDate: d(3), toDate: d(1) })).expect(400)).body.field).toBe("toDate");
			await create(valid({ fromDate: "2026-02-30", toDate: "2026-03-01" })).expect(400);
			expect((await create(valid({ toDate: d(500) })).expect(400)).body.field).toBe("toDate");
			await create(valid({ reason: "   " })).expect(400);
			await create(valid({ reason: "x".repeat(1001) })).expect(400);
			expect((await create(valid({ childId: w.withdrawn.id })).expect(409)).body.code).toBe("CHILD_NOT_ACTIVE");
			expect(await count("leave_requests")).toBe(0);
		});

		it("đơn nghỉ cho đúng hôm nay được chấp nhận", async () => {
			await create(valid({ fromDate: today(), toDate: today() })).expect(201);
		});

		it("chỉ phụ huynh đã liên kết gửi được; vai trò khác bị chặn", async () => {
			expect((await create(valid(), w.parentB).expect(403)).body.code).toBe("CHILD_ACCESS_DENIED");
			expect((await create(valid(), w.teacherA).expect(403)).body.code).toBe("ROLE_NOT_ALLOWED");
			await create(valid(), w.manager).expect(403);
			await http().post("/leave-requests").send(valid()).expect(401);
			await create(valid({ childId: "7b1f1e0e-0000-4000-8000-000000000000" })).expect(404);
		});

		it("trùng ngày với đơn PENDING/APPROVED bị 409; liền kề không trùng thì được", async () => {
			await create(valid({ fromDate: d(1), toDate: d(3) })).expect(201);
			expect((await create(valid({ fromDate: d(3), toDate: d(5) })).expect(409)).body.code).toBe("LEAVE_OVERLAP");
			expect((await create(valid({ fromDate: d(2), toDate: d(2) })).expect(409)).body.code).toBe("LEAVE_OVERLAP");
			await create(valid({ fromDate: d(4), toDate: d(5) })).expect(201);
			expect(await count("leave_requests")).toBe(2);
		});

		it("nhiều đơn trùng gửi cùng lúc: đúng một đơn được lưu, còn lại nhận 409 (không phải 500)", async () => {
			const results = await Promise.all(Array.from({ length: 6 }, () => create(valid({ fromDate: d(10), toDate: d(12) }))));
			expect(results.filter((r) => r.status === 201)).toHaveLength(1);
			expect(results.filter((r) => r.status === 409)).toHaveLength(5);
			expect(await count("leave_requests")).toBe(1);
		});

		it("danh sách theo phạm vi: phụ huynh thấy đơn của mình, giáo viên thấy đơn của lớp mình, quản lý thấy tất cả", async () => {
			await create(valid()).expect(201); // An (lớp A) - phụ huynh A
			await create(valid({ childId: w.binh.id }), w.parentB).expect(201); // Bình (lớp A) - phụ huynh B
			await create(valid({ childId: w.chi.id }), w.parentB).expect(201); // Chi (lớp B) - phụ huynh B
			const names = (res: { body: { items: Array<{ childName: string }> } }) => res.body.items.map((i) => i.childName).sort();
			expect(names(await http().get("/leave-requests", w.parentA).expect(200))).toEqual(["An"]);
			expect(names(await http().get("/leave-requests", w.parentB).expect(200))).toEqual(["Bình", "Chi"]);
			expect(names(await http().get("/leave-requests", w.teacherA).expect(200))).toEqual(["An", "Bình"]);
			expect(names(await http().get("/leave-requests", w.teacherB).expect(200))).toEqual(["Chi"]);
			expect(names(await http().get("/leave-requests", w.manager).expect(200))).toEqual(["An", "Bình", "Chi"]);
			await http().get("/leave-requests", w.medical).expect(403);
			const filtered = await http().get(`/leave-requests?classId=${w.classA.id}&limit=1`, w.manager).expect(200);
			expect(filtered.body.pageInfo).toMatchObject({ totalItems: 2, totalPages: 2, limit: 1 });
			await http().get("/leave-requests?status=NOPE", w.manager).expect(400);
		});

		it("giáo viên đúng lớp duyệt: lưu người duyệt; duyệt lần hai bị 409; giáo viên lớp khác và phụ huynh bị chặn", async () => {
			const { body: leave } = await create(valid()).expect(201);
			await http().post(`/leave-requests/${leave.id}/approve`, w.teacherB).expect(403);
			await http().post(`/leave-requests/${leave.id}/approve`, w.parentA).expect(403);
			const ok = await http().post(`/leave-requests/${leave.id}/approve`, w.teacherA).expect(200);
			expect(ok.body).toMatchObject({ status: "APPROVED", decidedByUserId: w.teacherA.id, decidedByName: "Cô A" });
			expect(ok.body.decidedAt).toEqual(expect.any(String));
			expect((await http().post(`/leave-requests/${leave.id}/approve`, w.teacherA).expect(409)).body.code).toBe("ALREADY_PROCESSED");
			expect((await http().post(`/leave-requests/${leave.id}/reject`, w.teacherA).send({ reason: "x" }).expect(409)).body.code).toBe("ALREADY_PROCESSED");
		});

		it("từ chối bắt buộc có lý do và lưu lý do", async () => {
			const { body: leave } = await create(valid()).expect(201);
			await http().post(`/leave-requests/${leave.id}/reject`, w.teacherA).send({}).expect(400);
			await http().post(`/leave-requests/${leave.id}/reject`, w.teacherA).send({ reason: "   " }).expect(400);
			const res = await http().post(`/leave-requests/${leave.id}/reject`, w.teacherA).send({ reason: "Trùng lịch kiểm tra" }).expect(200);
			expect(res.body).toMatchObject({ status: "REJECTED", decisionReason: "Trùng lịch kiểm tra" });
		});

		it("duyệt và từ chối cùng lúc: chỉ một bên thành công", async () => {
			const { body: leave } = await create(valid()).expect(201);
			const results = await Promise.all([
				http().post(`/leave-requests/${leave.id}/approve`, w.teacherA),
				http().post(`/leave-requests/${leave.id}/reject`, w.manager).send({ reason: "x" }),
				http().post(`/leave-requests/${leave.id}/approve`, w.manager),
			]);
			expect(results.filter((r) => r.status === 200)).toHaveLength(1);
			expect(results.filter((r) => r.status === 409)).toHaveLength(2);
		});

		it("phụ huynh rút đơn PENDING; đơn đã xử lý không rút được; đơn của người khác nhận 404; rút rồi gửi lại được", async () => {
			const { body: leave } = await create(valid()).expect(201);
			await http().patch(`/leave-requests/${leave.id}/cancel`, w.parentB).expect(404);
			await http().patch(`/leave-requests/${leave.id}/cancel`, w.teacherA).expect(403);
			const cancelled = await http().patch(`/leave-requests/${leave.id}/cancel`, w.parentA).expect(200);
			expect(cancelled.body.status).toBe("CANCELLED");
			await create(valid()).expect(201); // CANCELLED không còn chặn đơn mới
			const { body: other } = await create(valid({ fromDate: d(20), toDate: d(21) })).expect(201);
			await http().post(`/leave-requests/${other.id}/approve`, w.teacherA).expect(200);
			expect((await http().patch(`/leave-requests/${other.id}/cancel`, w.parentA).expect(409)).body.code).toBe("ALREADY_PROCESSED");
		});

		it("đơn bị từ chối hoặc đã rút không chặn đơn mới cùng ngày", async () => {
			const { body: leave } = await create(valid()).expect(201);
			await http().post(`/leave-requests/${leave.id}/reject`, w.teacherA).send({ reason: "x" }).expect(200);
			await create(valid()).expect(201);
		});
	});

	/* ============================== liên kết điểm danh và đơn nghỉ đã duyệt */
	describe("đơn nghỉ đã duyệt hiện trên bảng điểm danh", () => {
		it("trẻ có đơn nghỉ đã duyệt hôm nay hiện ABSENT + onLeave; đơn chưa duyệt thì không", async () => {
			const { body: leave } = await http().post("/leave-requests", w.parentA).send({ childId: w.an.id, fromDate: todayInSchool(), toDate: addDays(todayInSchool(), 1), reason: "Đi khám" }).expect(201);
			const pending = await http().get(`/classes/${w.classA.id}/attendance`, w.teacherA).expect(200);
			expect(pending.body.items.find((i: { name: string }) => i.name === "An")).toMatchObject({ status: "NOT_CHECKED_IN", onLeave: false });

			await http().post(`/leave-requests/${leave.id}/approve`, w.teacherA).expect(200);
			const approved = await http().get(`/classes/${w.classA.id}/attendance`, w.teacherA).expect(200);
			expect(approved.body.items.find((i: { name: string }) => i.name === "An")).toMatchObject({ status: "ABSENT", onLeave: true, attendanceId: null });
			const today = await http().get(`/children/${w.an.id}/attendance/today`, w.parentA).expect(200);
			expect(today.body).toMatchObject({ status: "ABSENT", onLeave: true });

			// Trẻ vẫn đến lớp dù có đơn nghỉ: bản ghi thật được ưu tiên
			await http().post("/attendance/check-in", w.teacherA).send({ childId: w.an.id }).expect(201);
			const after = await http().get(`/classes/${w.classA.id}/attendance`, w.teacherA).expect(200);
			const row = after.body.items.find((i: { name: string }) => i.name === "An");
			expect(["PRESENT", "LATE"]).toContain(row.status);
			expect(row.onLeave).toBe(true);
		});

		it("đơn nghỉ của ngày khác không ảnh hưởng ngày đang xem", async () => {
			const { body: leave } = await http().post("/leave-requests", w.parentA).send({ childId: w.an.id, fromDate: addDays(todayInSchool(), 3), toDate: addDays(todayInSchool(), 4), reason: "x" }).expect(201);
			await http().post(`/leave-requests/${leave.id}/approve`, w.teacherA).expect(200);
			const res = await http().get(`/classes/${w.classA.id}/attendance`, w.teacherA).expect(200);
			expect(res.body.items.find((i: { name: string }) => i.name === "An")).toMatchObject({ status: "NOT_CHECKED_IN", onLeave: false });
			const future = await http().get(`/classes/${w.classA.id}/attendance?date=${addDays(todayInSchool(), 3)}`, w.teacherA).expect(200);
			expect(future.body.items.find((i: { name: string }) => i.name === "An")).toMatchObject({ status: "ABSENT", onLeave: true });
		});
	});

	/* ======================================== transaction và sự kiện */
	describe("transaction rollback", () => {
		it("lỗi giữa chừng khi check-in: không để lại bản ghi dở dang", async () => {
			const audit = app.get(AuditLogsService, { strict: false });
			jest.spyOn(audit, "record").mockRejectedValueOnce(new Error("boom"));
			await http().post("/attendance/check-in", w.teacherA).send({ childId: w.an.id, checkInTime: iso(PAST, "07:50") }).expect(500);
			expect(await count("attendance")).toBe(0);
			expect(await count("audit_logs")).toBe(0);
			await http().post("/attendance/check-in", w.teacherA).send({ childId: w.an.id, checkInTime: iso(PAST, "07:50") }).expect(201); // thử lại bình thường
		});

		it("lỗi giữa chừng khi gửi đơn nghỉ và khi duyệt đơn: dữ liệu không đổi", async () => {
			const audit = app.get(AuditLogsService, { strict: false });
			const body = { childId: w.an.id, fromDate: addDays(todayInSchool(), 1), toDate: addDays(todayInSchool(), 2), reason: "x" };
			jest.spyOn(audit, "record").mockRejectedValueOnce(new Error("boom"));
			await http().post("/leave-requests", w.parentA).send(body).expect(500);
			expect(await count("leave_requests")).toBe(0);

			const { body: leave } = await http().post("/leave-requests", w.parentA).send(body).expect(201);
			jest.spyOn(audit, "record").mockRejectedValueOnce(new Error("boom"));
			await http().post(`/leave-requests/${leave.id}/approve`, w.teacherA).expect(500);
			const [row] = await dataSource.query(`SELECT status, decided_by_user_id FROM leave_requests WHERE id = $1`, [leave.id]);
			expect(row).toEqual({ status: "PENDING", decided_by_user_id: null });
		});

		it("lỗi khi sửa điểm danh: giá trị cũ được giữ nguyên", async () => {
			const rec = (await http().post("/attendance/check-in", w.teacherA).send({ childId: w.an.id, checkInTime: iso(PAST, "07:50") }).expect(201)).body;
			const audit = app.get(AuditLogsService, { strict: false });
			jest.spyOn(audit, "record").mockRejectedValueOnce(new Error("boom"));
			await http().patch(`/attendance/${rec.id}`, w.teacherA).send({ status: "ABSENT" }).expect(500);
			const [row] = await dataSource.query(`SELECT status FROM attendance WHERE id = $1`, [rec.id]);
			expect(row.status).toBe("PRESENT");
		});
	});

	describe("sự kiện nghiệp vụ (nền cho thông báo ở Stage 6)", () => {
		it("phát đúng sự kiện sau khi lưu thành công, không chứa dữ liệu thừa", async () => {
			const seen: unknown[] = [];
			const off = [
				events.subscribe("attendance.recorded", (e) => { seen.push(["attendance", e]); }),
				events.subscribe("leave-request.created", (e) => { seen.push(["created", e]); }),
				events.subscribe("leave-request.decided", (e) => { seen.push(["decided", e]); }),
			];
			try {
				const ci = await http().post("/attendance/check-in", w.teacherA).send({ childId: w.an.id, checkInTime: iso(PAST, "07:50") }).expect(201);
				await http().post("/attendance/check-in", w.teacherA).send({ childId: w.an.id, checkInTime: iso(PAST, "07:50") }).expect(409); // thất bại: không phát
				await http().post("/attendance/check-out", w.teacherA).send({ childId: w.an.id, date: PAST, checkOutTime: iso(PAST, "16:00") }).expect(200);
				const leave = (await http().post("/leave-requests", w.parentA).send({ childId: w.an.id, fromDate: addDays(todayInSchool(), 1), toDate: addDays(todayInSchool(), 1), reason: "x" }).expect(201)).body;
				await http().post(`/leave-requests/${leave.id}/reject`, w.teacherA).send({ reason: "Không hợp lệ" }).expect(200);
				expect(seen).toEqual([
					["attendance", { attendanceId: ci.body.id, childId: w.an.id, classId: w.classA.id, date: PAST, action: "CHECK_IN", status: "PRESENT", actorUserId: w.teacherA.id }],
					["attendance", expect.objectContaining({ action: "CHECK_OUT", childId: w.an.id })],
					["created", expect.objectContaining({ leaveRequestId: leave.id, classId: w.classA.id, parentUserId: w.parentA.id })],
					["decided", expect.objectContaining({ leaveRequestId: leave.id, decision: "REJECTED", reason: "Không hợp lệ", decidedByUserId: w.teacherA.id })],
				]);
			} finally {
				off.forEach((unsubscribe) => unsubscribe());
			}
		});

		it("người lắng nghe bị lỗi không làm hỏng request đã thành công", async () => {
			const off = events.subscribe("attendance.recorded", () => { throw new Error("listener fail"); });
			const offAsync = events.subscribe("attendance.recorded", async () => { throw new Error("async listener fail"); });
			try {
				await http().post("/attendance/check-in", w.teacherA).send({ childId: w.an.id, checkInTime: iso(PAST, "07:50") }).expect(201);
				expect(await count("attendance")).toBe(1);
			} finally {
				off();
				offAsync();
			}
		});
	});

	describe("bảo mật dữ liệu trả về", () => {
		it("phản hồi không chứa mật khẩu, hash hay thông tin người dùng thừa", async () => {
			await http().post("/attendance/check-in", w.teacherA).send({ childId: w.an.id, checkInTime: iso(PAST, "07:50") }).expect(201);
			const leave = await http().post("/leave-requests", w.parentA).send({ childId: w.an.id, fromDate: addDays(todayInSchool(), 1), toDate: addDays(todayInSchool(), 1), reason: "x" }).expect(201);
			const bodies = [
				(await http().get(`/classes/${w.classA.id}/attendance?date=${PAST}`, w.teacherA)).body,
				(await http().get(`/children/${w.an.id}/attendance`, w.parentA)).body,
				(await http().get("/leave-requests", w.teacherA)).body,
				leave.body,
			];
			const text = JSON.stringify(bodies);
			expect(text).not.toMatch(/password|passwordHash|not-a-real-hash/i);
			expect(text).not.toContain("teacher.a@test.vn");
		});
	});
});
