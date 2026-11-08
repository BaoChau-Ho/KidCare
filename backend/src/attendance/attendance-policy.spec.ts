import { isEarlyLeave, statusForCheckIn } from "./attendance-policy";

// Giờ chuẩn mặc định: vào lớp 08:00, tan học 16:00, múi giờ Asia/Ho_Chi_Minh (UTC+7).
const at = (hhmm: string, seconds = "00") => new Date(`2026-01-05T${hhmm}:${seconds}+07:00`);

describe("statusForCheckIn", () => {
	it.each([
		["07:30", "PRESENT"],
		["07:59", "PRESENT"],
		["08:00", "PRESENT"], // đúng giờ chuẩn chưa tính muộn
		["08:01", "LATE"], // muộn 1 phút
		["08:30", "LATE"],
		["23:59", "LATE"],
	])("đến lúc %s -> %s", (time, expected) => {
		expect(statusForCheckIn(at(time))).toBe(expected);
	});

	it("so theo phút: 08:00:59 vẫn đúng giờ", () => {
		expect(statusForCheckIn(at("08:00", "59"))).toBe("PRESENT");
	});

	it("tính theo giờ của trường chứ không theo UTC", () => {
		// 01:05 UTC = 08:05 giờ Việt Nam -> muộn
		expect(statusForCheckIn(new Date("2026-01-05T01:05:00Z"))).toBe("LATE");
		// 00:30 UTC = 07:30 giờ Việt Nam -> đúng giờ
		expect(statusForCheckIn(new Date("2026-01-05T00:30:00Z"))).toBe("PRESENT");
	});

	it("cho phép cấu hình giờ chuẩn", () => {
		expect(statusForCheckIn(at("08:20"), "08:30")).toBe("PRESENT");
		expect(statusForCheckIn(at("08:31"), "08:30")).toBe("LATE");
	});
});

describe("isEarlyLeave", () => {
	it.each([
		["15:59", true],
		["16:00", false], // đúng giờ tan học
		["16:30", false],
		["11:00", true],
	])("về lúc %s -> về sớm = %s", (time, expected) => {
		expect(isEarlyLeave(at(time))).toBe(expected);
	});

	it("chưa check-out thì không phải về sớm", () => {
		expect(isEarlyLeave(null)).toBe(false);
	});
});
