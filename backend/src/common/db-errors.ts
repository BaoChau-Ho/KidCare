// Mã lỗi PostgreSQL dùng để chuyển lỗi ràng buộc ở database thành lỗi nghiệp vụ rõ ràng.
function pgCode(error: unknown): string | null {
	if (typeof error !== "object" || error === null) return null;
	const direct = "code" in error ? error.code : null;
	if (typeof direct === "string") return direct;
	// TypeORM bọc lỗi của driver trong QueryFailedError.driverError
	const driver = "driverError" in error ? error.driverError : null;
	if (typeof driver === "object" && driver !== null && "code" in driver && typeof driver.code === "string") return driver.code;
	return null;
}

/** 23505: vi phạm UNIQUE */
export const isUniqueViolation = (error: unknown) => pgCode(error) === "23505";
/** 23P01: vi phạm EXCLUDE (ví dụ hai đơn nghỉ giao nhau gửi cùng lúc) */
export const isExclusionViolation = (error: unknown) => pgCode(error) === "23P01";
