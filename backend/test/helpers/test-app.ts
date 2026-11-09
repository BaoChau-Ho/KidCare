import { CanActivate, ExecutionContext, INestApplication, Injectable, UnauthorizedException, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../../src/app.module";
import { JwtAuthGuard } from "../../src/auth/jwt-auth.guard";
import type { AuthenticatedRequest } from "../../src/auth/jwt-auth.guard";
import { ChildParent } from "../../src/children/child-parent.entity";
import { Child } from "../../src/children/child.entity";
import { ClassTeacher } from "../../src/classes/class-teacher.entity";
import { Classroom } from "../../src/classes/class.entity";
import { User } from "../../src/users/user.entity";

/**
 * Guard dành cho test: đọc id người dùng từ header x-test-user và nạp user từ database,
 * để test API không phụ thuộc quy trình đăng nhập/JWT. Chỉ thay JwtAuthGuard trong test.
 */
@Injectable()
class TestAuthGuard implements CanActivate {
	constructor(private readonly dataSource: DataSource) {}
	async canActivate(context: ExecutionContext) {
		const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
		const id = req.headers["x-test-user"];
		if (typeof id !== "string") throw new UnauthorizedException();
		const user = await this.dataSource.getRepository(User).findOneBy({ id });
		if (!user || user.status !== "ACTIVE") throw new UnauthorizedException();
		req.user = { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
		return true;
	}
}

export async function createTestApp() {
	const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
		.overrideGuard(JwtAuthGuard)
		.useClass(TestAuthGuard)
		.compile();
	const app = moduleRef.createNestApplication();
	// Giống main.ts: dùng ValidationPipe có transform để các DTO có giá trị mặc định (page, limit) hoạt động.
	app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
	await app.init();
	const dataSource = app.get(DataSource);
	// DatabaseModule tạo DataSource bằng useFactory nên app.close() không đóng kết nối, làm Jest không thoát.
	// Gói lại close() để các file test chỉ cần gọi app.close() như bình thường.
	const closeApp = app.close.bind(app);
	app.close = async () => {
		await closeApp();
		if (dataSource.isInitialized) await dataSource.destroy();
	};
	return { app, dataSource, moduleRef };
}

export const api = (app: INestApplication) => ({
	get: (path: string, as?: { id: string }) => withUser(request(app.getHttpServer()).get(path), as),
	post: (path: string, as?: { id: string }) => withUser(request(app.getHttpServer()).post(path), as),
	patch: (path: string, as?: { id: string }) => withUser(request(app.getHttpServer()).patch(path), as),
});
function withUser<T extends request.Test>(req: T, as?: { id: string }): T {
	return as ? (req.set("x-test-user", as.id) as T) : req;
}

/**
 * Dữ liệu nền cho test. CHỈNH hàm này cho khớp entity User thật của dự án
 * (tên cột mật khẩu, các trường bắt buộc khác).
 */
export async function resetDatabase(dataSource: DataSource) {
	await dataSource.query(
		`TRUNCATE TABLE leave_requests, attendance, audit_logs, child_parents, class_teachers, children, classes, users RESTART IDENTITY CASCADE`,
	);
}

export async function seedWorld(dataSource: DataSource) {
	const users = dataSource.getRepository(User);
	const mk = (email: string, fullName: string, role: User["role"], status: User["status"] = "ACTIVE") =>
		users.save(users.create({ email, fullName, role, status, passwordHash: "not-a-real-hash" }));

	const manager = await mk("manager@test.vn", "Quản Lý", "MANAGER");
	const teacherA = await mk("teacher.a@test.vn", "Cô A", "TEACHER");
	const teacherB = await mk("teacher.b@test.vn", "Cô B", "TEACHER");
	const parentA = await mk("parent.a@test.vn", "Phụ Huynh A", "PARENT");
	const parentB = await mk("parent.b@test.vn", "Phụ Huynh B", "PARENT");
	const medical = await mk("medical@test.vn", "Y Tế", "MEDICAL_STAFF");
	const admin = await mk("admin@test.vn", "Quản Trị", "ADMIN");

	const classes = dataSource.getRepository(Classroom);
	const classA = await classes.save(classes.create({ name: "Mầm 1", academicYear: "2026-2027", status: "ACTIVE" }));
	const classB = await classes.save(classes.create({ name: "Chồi 1", academicYear: "2026-2027", status: "ACTIVE" }));

	const assignments = dataSource.getRepository(ClassTeacher);
	await assignments.save([
		assignments.create({ classId: classA.id, teacherUserId: teacherA.id }),
		assignments.create({ classId: classB.id, teacherUserId: teacherB.id }),
	]);

	const children = dataSource.getRepository(Child);
	const mkChild = (name: string, classId: string, status: Child["status"] = "ACTIVE") =>
		children.save(children.create({ name, dateOfBirth: "2022-03-14", gender: "MALE", address: null, avatarUrl: null, classId, status }));
	const an = await mkChild("An", classA.id);
	const binh = await mkChild("Bình", classA.id);
	const chi = await mkChild("Chi", classB.id);
	const withdrawn = await mkChild("Đã nghỉ", classA.id, "WITHDRAWN");

	const links = dataSource.getRepository(ChildParent);
	await links.save([
		links.create({ childId: an.id, parentUserId: parentA.id, relationship: "FATHER" }),
		links.create({ childId: binh.id, parentUserId: parentB.id, relationship: "MOTHER" }),
		links.create({ childId: chi.id, parentUserId: parentB.id, relationship: "MOTHER" }),
		links.create({ childId: withdrawn.id, parentUserId: parentA.id, relationship: "GUARDIAN" }),
	]);

	return { manager, teacherA, teacherB, parentA, parentB, medical, admin, classA, classB, an, binh, chi, withdrawn };
}
export type World = Awaited<ReturnType<typeof seedWorld>>;
