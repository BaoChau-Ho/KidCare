import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as argon2 from "argon2";
import AppDataSource from "./data-source";
import { ChildParent } from "../children/child-parent.entity";
import { Child } from "../children/child.entity";
import { ClassTeacher } from "../classes/class-teacher.entity";
import { Classroom } from "../classes/class.entity";
import { User, type UserRole, type UserStatus } from "../users/user.entity";

type MockUser = {
	id: string;
	email: string;
	fullName?: string | null;
	phone?: string | null;
	role: UserRole;
	status: UserStatus;
};

type MockClass = {
	id: string;
	name: string;
	academicYear: string;
	status: "ACTIVE" | "CLOSED";
};

type MockChild = {
	id: string;
	name: string;
	dateOfBirth: string;
	gender: "MALE" | "FEMALE" | "OTHER";
	address?: string | null;
	avatarUrl?: string | null;
	classId: string;
	status: "ACTIVE" | "INACTIVE" | "WITHDRAWN";
};

type MockData = {
	users: MockUser[];
	credentials: Record<string, string>;
	classes: MockClass[];
	children: MockChild[];
	classTeachers: Array<{ classId: string; teacherUserId: string }>;
	childParents: Array<{
		childId: string;
		parentUserId: string;
		relationship: "FATHER" | "MOTHER" | "GUARDIAN";
	}>;
};

function isUuid(value: unknown): value is string {
	return typeof value === "string" &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validateMockData(data: Partial<MockData>): asserts data is MockData {
	if (
		!Array.isArray(data.users) ||
		!Array.isArray(data.classes) ||
		!Array.isArray(data.children) ||
		!Array.isArray(data.classTeachers) ||
		!Array.isArray(data.childParents) ||
		!data.credentials ||
		typeof data.credentials !== "object"
	) {
		throw new Error("JSON thiếu một hoặc nhiều danh sách Stage 2 từ mockDB.js.");
	}

	for (const [label, rows] of [
		["users", data.users],
		["classes", data.classes],
		["children", data.children],
	] as const) {
		for (const row of rows) {
			if (!isUuid(row.id)) throw new Error(`ID không phải UUID hợp lệ trong ${label}.`);
		}
	}
}

async function importMockData() {
	const args = process.argv.slice(2);
	if (!args.includes("--confirm")) {
		throw new Error(
			"Đây là thao tác ghi dữ liệu kiểm thử. Chạy lại và thêm --confirm để xác nhận.",
		);
	}

	const inputFile = args.find((arg) => !arg.startsWith("--")) ?? "../mock-data.json";
	const inputPath = resolve(process.cwd(), inputFile);
	const source = JSON.parse(await readFile(inputPath, "utf8")) as Partial<MockData>;
	validateMockData(source);

	await AppDataSource.initialize();
	try {
		const counts = await AppDataSource.transaction(async (manager) => {
			const usersRepository = manager.getRepository(User);
			const classesRepository = manager.getRepository(Classroom);
			const childrenRepository = manager.getRepository(Child);
			const classTeachersRepository = manager.getRepository(ClassTeacher);
			const childParentsRepository = manager.getRepository(ChildParent);
			const userIds = new Map<string, string>();
			const classIds = new Map<string, string>();

			for (const mockUser of source.users) {
				const email = mockUser.email.trim().toLowerCase();
				const password = source.credentials[email];
				if (!password) throw new Error(`Không có mật khẩu mock cho ${email}.`);
				const current = await usersRepository.findOneBy({ email });
				const passwordHash = await argon2.hash(password);
				const user = usersRepository.create({
					...(current ? { id: current.id } : { id: mockUser.id }),
					email,
					passwordHash,
					fullName: mockUser.fullName ?? null,
					phone: mockUser.phone ?? null,
					nationalId: current?.nationalId ?? null,
					role: mockUser.role,
					status: mockUser.status,
				});
				const saved = await usersRepository.save(user);
				userIds.set(mockUser.id, saved.id);
			}

			for (const mockClass of source.classes) {
				const current = await classesRepository.findOneBy({
					name: mockClass.name,
					academicYear: mockClass.academicYear,
				});
				const saved = await classesRepository.save(classesRepository.create({
					...(current ? { id: current.id } : { id: mockClass.id }),
					name: mockClass.name,
					academicYear: mockClass.academicYear,
					status: mockClass.status,
				}));
				classIds.set(mockClass.id, saved.id);
			}

			for (const mockChild of source.children) {
				const classId = classIds.get(mockChild.classId);
				if (!classId) throw new Error(`Không tìm thấy lớp cho trẻ ${mockChild.name}.`);
				await childrenRepository.save(childrenRepository.create({
					...mockChild,
					classId,
					address: mockChild.address ?? null,
					avatarUrl: mockChild.avatarUrl ?? null,
				}));
			}

			for (const assignment of source.classTeachers) {
				const classId = classIds.get(assignment.classId);
				const teacherUserId = userIds.get(assignment.teacherUserId);
				if (!classId || !teacherUserId) throw new Error("Phân công giáo viên tham chiếu ID không tồn tại.");
				await classTeachersRepository.save(classTeachersRepository.create({ classId, teacherUserId }));
			}

			for (const link of source.childParents) {
				const parentUserId = userIds.get(link.parentUserId);
				if (!parentUserId) throw new Error("Liên kết phụ huynh tham chiếu user không tồn tại.");
				await childParentsRepository.save(childParentsRepository.create({
					childId: link.childId,
					parentUserId,
					relationship: link.relationship,
				}));
			}

			return {
				users: source.users.length,
				classes: source.classes.length,
				children: source.children.length,
				classTeachers: source.classTeachers.length,
				childParents: source.childParents.length,
			};
		});

		console.log("Đã import dữ liệu mock Stage 2:", counts);
		console.log("Mật khẩu mock mẫu: Password@123");
	} finally {
		await AppDataSource.destroy();
	}
}

void importMockData().catch((error: unknown) => {
	console.error("Import mock data thất bại:", error);
	process.exitCode = 1;
});
