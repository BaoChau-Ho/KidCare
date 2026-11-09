import { addDays, daysBetween, isValidDateString, toSchoolDate, toSchoolTime } from "./school-time";

describe("school-time", () => {
	it("ngày và giờ được tính theo múi giờ của trường (UTC+7), không theo UTC", () => {
		const instant = new Date("2026-01-05T18:30:00Z"); // 01:30 ngày 06/01 giờ Việt Nam
		expect(toSchoolDate(instant)).toBe("2026-01-06");
		expect(toSchoolTime(instant)).toBe("01:30");
	});

	it("nửa đêm hiển thị 00:xx chứ không phải 24:xx", () => {
		expect(toSchoolTime(new Date("2026-01-05T17:05:00Z"))).toBe("00:05");
	});

	it("isValidDateString từ chối ngày không có thật", () => {
		expect(isValidDateString("2026-02-28")).toBe(true);
		expect(isValidDateString("2026-02-30")).toBe(false);
		expect(isValidDateString("2026-13-01")).toBe(false);
		expect(isValidDateString("abcd-ef-gh")).toBe(false);
		expect(isValidDateString("2028-02-29")).toBe(true); // năm nhuận
		expect(isValidDateString("2026-02-29")).toBe(false);
	});

	it("addDays và daysBetween qua ranh giới tháng và năm", () => {
		expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
		expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
		expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
		expect(daysBetween("2026-02-01", "2026-01-01")).toBe(-31);
	});
});
