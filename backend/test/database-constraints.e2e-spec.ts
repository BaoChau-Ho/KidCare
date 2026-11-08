import { DataSource } from "typeorm";
import { createTestApp, resetDatabase, seedWorld } from "./helpers/test-app";
import type { World } from "./helpers/test-app";

// Kiểm tra trực tiếp các ràng buộc ở database: đây là lớp bảo vệ cuối cùng, độc lập với code service.
describe("Stage 3 — ràng buộc database", () => {
	let dataSource: DataSource;
	let close: () => Promise<void>;
	let w: World;

	beforeAll(async () => {
		const ctx = await createTestApp();
		dataSource = ctx.dataSource;
		close = () => ctx.app.close();
	});
	afterAll(async () => { await close(); });
	beforeEach(async () => {
		await resetDatabase(dataSource);
		w = await seedWorld(dataSource);
	});

	const attendance = (over: Record<string, unknown> = {}) => {
		const v = { child: w.an.id, date: "2026-01-05", status: "PRESENT", inT: "2026-01-05T01:00:00Z", outT: null, by: w.teacherA.id, ...over };
		return dataSource.query(
			`INSERT INTO attendance (child_id, date, status, check_in_time, check_out_time, recorded_by_user_id) VALUES ($1, $2, $3, $4, $5, $6)`,
			[v.child, v.date, v.status, v.inT, v.outT, v.by],
		);
	};
	const leave = (from: string, to: string, status = "PENDING", child = w.an.id) =>
		dataSource.query(
			`INSERT INTO leave_requests (child_id, parent_user_id, from_date, to_date, reason, status) VALUES ($1, $2, $3, $4, 'x', $5)`,
			[child, w.parentA.id, from, to, status],
		);

	describe("attendance", () => {
		it("unique (child_id, date)", async () => {
			await attendance();
			await expect(attendance()).rejects.toMatchObject({ code: "23505" });
			await attendance({ date: "2026-01-06" }); // ngày khác thì được
			await attendance({ child: w.binh.id }); // trẻ khác thì được
		});
		it("status chỉ nhận 4 giá trị", async () => {
			await expect(attendance({ status: "WHATEVER" })).rejects.toMatchObject({ code: "23514" });
		});
		it("giờ về không được trước giờ đến, và không có giờ về khi chưa có giờ đến", async () => {
			await expect(attendance({ outT: "2026-01-05T00:00:00Z" })).rejects.toMatchObject({ code: "23514" });
			await expect(attendance({ date: "2026-01-06", inT: null, outT: "2026-01-06T09:00:00Z" })).rejects.toMatchObject({ code: "23514" });
			await attendance({ date: "2026-01-07", outT: "2026-01-05T09:00:00Z" });
		});
		it("bản ghi vắng không có giờ", async () => {
			await expect(attendance({ status: "ABSENT" })).rejects.toMatchObject({ code: "23514" });
			await attendance({ status: "ABSENT", inT: null, outT: null });
		});
		it("khóa ngoại: không ghi cho trẻ hoặc người dùng không tồn tại; không xóa được trẻ đã có điểm danh", async () => {
			await expect(attendance({ child: "7b1f1e0e-0000-4000-8000-000000000000" })).rejects.toMatchObject({ code: "23503" });
			await expect(attendance({ by: "7b1f1e0e-0000-4000-8000-000000000000" })).rejects.toMatchObject({ code: "23503" });
			await attendance();
			await expect(dataSource.query(`DELETE FROM children WHERE id = $1`, [w.an.id])).rejects.toMatchObject({ code: "23503" });
		});
	});

	describe("leave_requests", () => {
		it("ngày kết thúc không trước ngày bắt đầu; status chỉ nhận 4 giá trị", async () => {
			await expect(leave("2026-03-05", "2026-03-04")).rejects.toMatchObject({ code: "23514" });
			await expect(leave("2026-03-05", "2026-03-06", "WHATEVER")).rejects.toMatchObject({ code: "23514" });
		});
		it("loại trừ: hai đơn PENDING/APPROVED của cùng trẻ không được giao ngày (kể cả chỉ trùng một ngày)", async () => {
			await leave("2026-03-01", "2026-03-03");
			await expect(leave("2026-03-03", "2026-03-05")).rejects.toMatchObject({ code: "23P01" });
			await expect(leave("2026-02-27", "2026-03-01", "APPROVED")).rejects.toMatchObject({ code: "23P01" });
			await expect(leave("2026-03-02", "2026-03-02")).rejects.toMatchObject({ code: "23P01" });
			await leave("2026-03-04", "2026-03-05"); // liền kề, không giao
		});
		it("loại trừ chỉ áp dụng cho đơn còn hiệu lực và đúng từng trẻ", async () => {
			await leave("2026-03-01", "2026-03-03", "CANCELLED");
			await leave("2026-03-01", "2026-03-03", "REJECTED");
			await leave("2026-03-01", "2026-03-03", "PENDING"); // đơn đã hủy/từ chối không chặn
			await leave("2026-03-01", "2026-03-03", "PENDING", w.binh.id); // trẻ khác không chặn
		});
		it("khóa ngoại tới trẻ và phụ huynh", async () => {
			await expect(leave("2026-03-01", "2026-03-02", "PENDING", "7b1f1e0e-0000-4000-8000-000000000000")).rejects.toMatchObject({ code: "23503" });
		});
	});
});
