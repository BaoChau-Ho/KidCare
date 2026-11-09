import { ATTENDANCE_END_TIME, ATTENDANCE_START_TIME, toSchoolTime } from "../common/school-time";

// Quy tắc trạng thái điểm danh, viết thành hàm thuần để test sát biên (stage-3: "viết thành một hàm riêng").

/** Đến sau giờ vào lớp chuẩn (so theo phút, giờ của trường) là LATE; đúng giờ hoặc sớm hơn là PRESENT. */
export function statusForCheckIn(checkIn: Date, startTime: string = ATTENDANCE_START_TIME): "PRESENT" | "LATE" {
	return toSchoolTime(checkIn) > startTime ? "LATE" : "PRESENT";
}

/** Về trước giờ tan học chuẩn. Chỉ có ý nghĩa với trẻ đã có mặt. */
export function isEarlyLeave(checkOut: Date | null, endTime: string = ATTENDANCE_END_TIME): boolean {
	return checkOut !== null && toSchoolTime(checkOut) < endTime;
}
