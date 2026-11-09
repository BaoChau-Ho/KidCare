// Giờ chuẩn và múi giờ của trường. "Hôm nay", giờ đến muộn và giờ về sớm luôn tính theo giờ của trường,
// không theo múi giờ của máy chủ (máy chủ thường chạy UTC nên 00:00-07:00 giờ Việt Nam vẫn là "hôm qua").
export const SCHOOL_TIME_ZONE = process.env.SCHOOL_TIME_ZONE ?? "Asia/Ho_Chi_Minh";
export const ATTENDANCE_START_TIME = process.env.ATTENDANCE_START_TIME ?? "08:00";
export const ATTENDANCE_END_TIME = process.env.ATTENDANCE_END_TIME ?? "16:00";

const formatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: SCHOOL_TIME_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});

function parts(date: Date): Record<string, string> {
	const result: Record<string, string> = {};
	for (const part of formatter.formatToParts(date)) result[part.type] = part.value;
	return result;
}

/** Ngày (YYYY-MM-DD) của một thời điểm theo giờ của trường. */
export function toSchoolDate(date: Date): string {
	const p = parts(date);
	return `${p.year}-${p.month}-${p.day}`;
}

/** Giờ phút (HH:mm) của một thời điểm theo giờ của trường. */
export function toSchoolTime(date: Date): string {
	const p = parts(date);
	return `${p.hour}:${p.minute}`;
}

export function todayInSchool(now = new Date()): string {
	return toSchoolDate(now);
}

/** Đúng định dạng YYYY-MM-DD và là ngày có thật (không nhận 2026-02-30). */
export function isValidDateString(value: string): boolean {
	const date = new Date(`${value}T00:00:00.000Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addDays(date: string, days: number): string {
	const d = new Date(`${date}T00:00:00.000Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
	return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000);
}
