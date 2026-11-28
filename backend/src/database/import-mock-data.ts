import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import * as argon2 from "argon2";
import type { DeepPartial, EntityTarget, ObjectLiteral } from "typeorm";
import AppDataSource from "./data-source";
import { Attendance } from "../attendance/attendance.entity";
import { ChildParent } from "../children/child-parent.entity";
import { Child } from "../children/child.entity";
import { ActivityImage } from "../activities/activity-image.entity";
import { ActivityParticipant } from "../activities/activity-participant.entity";
import { Activity } from "../activities/activity.entity";
import { ClassTeacher } from "../classes/class-teacher.entity";
import { Classroom } from "../classes/class.entity";
import { Allergy } from "../health-records/allergy.entity";
import { HealthRecord } from "../health-records/health-record.entity";
import { MedicalCondition } from "../health-records/medical-condition.entity";
import { MedicalVisit } from "../health-records/medical-visit.entity";
import { Medication } from "../health-records/medication.entity";
import { Vaccination } from "../health-records/vaccination.entity";
import { LeaveRequest } from "../leave-requests/leave-request.entity";
import { Notification } from "../notifications/notification.entity";
import { PickupRequest } from "../pickup-requests/pickup-request.entity";
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
	attendance?: Array<Record<string, any>>;
	leaveRequests?: Array<Record<string, any>>;
	healthRecords?: Array<Record<string, any>>;
	allergies?: Array<Record<string, any>>;
	medicalConditions?: Array<Record<string, any>>;
	vaccinations?: Array<Record<string, any>>;
	medicalVisits?: Array<Record<string, any>>;
	activities?: Array<Record<string, any>>;
	activityParticipants?: Array<Record<string, any>>;
	activityImages?: Array<Record<string, any>>;
	pickupRequests?: Array<Record<string, any>>;
	notifications?: Array<Record<string, any>>;
};

type IdMaps = { user: Map<string, string>; class: Map<string, string>; child: Map<string, string> };

function mappedId(map: Map<string, string>, id: string | null | undefined, label: string): string | null {
	if (id == null) return null;
	const value = map.get(id);
	if (!value) throw new Error(`${label} tham chiếu ID không tồn tại: ${id}`);
	return value;
}

function parseMockImage(image: Record<string, any>) {
	const url = typeof image.url === "string" ? image.url : "";
	const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
	if (!match) throw new Error(`Ảnh mock ${image.id} không phải data URL PNG/JPEG/WEBP hợp lệ.`);
	const mimeType = match[1];
	const buffer = Buffer.from(match[2], "base64");
	if (!buffer.length || buffer.length > 2 * 1024 * 1024) throw new Error(`Ảnh mock ${image.id} rỗng hoặc vượt quá 2 MB.`);
	const validSignature = mimeType === "image/png"
		? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
		: mimeType === "image/jpeg"
			? buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
			: buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
	if (!validSignature) throw new Error(`Nội dung ảnh mock ${image.id} không khớp MIME type.`);
	const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.slice("image/".length);
	return { buffer, mimeType, objectKey: `${image.activityId}/${image.id}.${extension}` };
}

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
			const ids: IdMaps = { user: new Map(), class: new Map(), child: new Map() };
			const usersRepository = manager.getRepository(User);
			const classesRepository = manager.getRepository(Classroom);
			const childrenRepository = manager.getRepository(Child);
			const classTeachersRepository = manager.getRepository(ClassTeacher);
			const childParentsRepository = manager.getRepository(ChildParent);

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
				ids.user.set(mockUser.id, saved.id);
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
				ids.class.set(mockClass.id, saved.id);
			}

			for (const mockChild of source.children) {
				const classId = ids.class.get(mockChild.classId);
				if (!classId) throw new Error(`Không tìm thấy lớp cho trẻ ${mockChild.name}.`);
				await childrenRepository.save(childrenRepository.create({
					...mockChild,
					classId,
					address: mockChild.address ?? null,
					avatarUrl: mockChild.avatarUrl ?? null,
				}));
				ids.child.set(mockChild.id, mockChild.id);
			}

			for (const assignment of source.classTeachers) {
				const classId = ids.class.get(assignment.classId);
				const teacherUserId = ids.user.get(assignment.teacherUserId);
				if (!classId || !teacherUserId) throw new Error("Phân công giáo viên tham chiếu ID không tồn tại.");
				await classTeachersRepository.save(classTeachersRepository.create({ classId, teacherUserId }));
			}

			for (const link of source.childParents) {
				const childId = mappedId(ids.child, link.childId, "Liên kết phụ huynh");
				const parentUserId = ids.user.get(link.parentUserId);
				if (!parentUserId) throw new Error("Liên kết phụ huynh tham chiếu user không tồn tại.");
				await childParentsRepository.save(childParentsRepository.create({
					childId: childId!,
					parentUserId,
					relationship: link.relationship,
				}));
			}

			const saveRows = async <T extends ObjectLiteral>(target: EntityTarget<T>, rows: unknown[]) => {
				if (rows.length) await manager.getRepository(target).save(rows as DeepPartial<T>[]);
			};
			const childId = (id: string) => mappedId(ids.child, id, "childId")!;
			const userId = (id: string | null | undefined, label: string) => mappedId(ids.user, id, label);
			const optionalRows = (rows?: Array<Record<string, any>>) => rows ?? [];
			const attendance = optionalRows(source.attendance);
			await saveRows(Attendance, attendance.map((row) => ({
				...row, childId: childId(row.childId), recordedByUserId: userId(row.recordedByUserId, "attendance.recordedByUserId"),
				checkedOutByUserId: userId(row.checkedOutByUserId, "attendance.checkedOutByUserId"),
				checkInTime: row.checkInTime ? new Date(row.checkInTime) : null,
				checkOutTime: row.checkOutTime ? new Date(row.checkOutTime) : null,
			})));
			const leaveRequests = optionalRows(source.leaveRequests);
			await saveRows(LeaveRequest, leaveRequests.map((row) => ({
				...row, childId: childId(row.childId), parentUserId: userId(row.parentUserId, "leaveRequests.parentUserId"),
				decidedByUserId: userId(row.decidedByUserId, "leaveRequests.decidedByUserId"), decidedAt: row.decidedAt ? new Date(row.decidedAt) : null,
			})));
			const healthRecords = optionalRows(source.healthRecords);
			await saveRows(HealthRecord, healthRecords.map((row) => ({
				id: row.id, childId: childId(row.childId), recordedByStaffUserId: userId(row.recordedByUserId, "healthRecords.recordedByUserId"),
				height: row.height ?? null, weight: row.weight ?? null, temperature: row.temperature ?? null, note: row.note ?? null,
				recordedAt: new Date(row.recordedAt),
			})));
			const allergies = optionalRows(source.allergies).map((row) => ({ ...row, childId: childId(row.childId) }));
			const medicalConditions = optionalRows(source.medicalConditions).map((row) => ({ ...row, childId: childId(row.childId) }));
			await saveRows(Allergy, allergies);
			await saveRows(MedicalCondition, medicalConditions);
			const vaccinations = optionalRows(source.vaccinations).map((row) => ({
				id: row.id, childId: childId(row.childId), vaccineName: row.vaccineName, doseNumber: row.doseNumber,
				vaccinatedAt: row.vaccinatedAt, nextDueDate: row.nextDueDate ?? null,
			}));
			await saveRows(Vaccination, vaccinations);
			const medicalVisits = optionalRows(source.medicalVisits);
			await saveRows(MedicalVisit, medicalVisits.map((row) => ({
				id: row.id, childId: childId(row.childId), recordedByStaffUserId: userId(row.examinerUserId, "medicalVisits.examinerUserId"),
				visitedAt: new Date(row.visitedAt), symptoms: row.symptoms ?? null, conclusion: row.conclusion ?? null,
			})));
			const medicationsRepository = manager.getRepository(Medication);
			for (const visit of medicalVisits) {
				await medicationsRepository.delete({ medicalVisitId: visit.id });
				const medications = Array.isArray(visit.medications) ? visit.medications : [];
				if (medications.length) await medicationsRepository.save(medications.map((medication: Record<string, any>) => ({
					medicalVisitId: visit.id, name: medication.name, dosage: medication.dosage, schedule: medication.schedule,
				})));
			}
			const activities = optionalRows(source.activities);
			await saveRows(Activity, activities.map((row) => ({
				...row, classId: mappedId(ids.class, row.classId, "activities.classId"),
				createdByTeacherUserId: userId(row.createdByTeacherUserId, "activities.createdByTeacherUserId"),
			})));
			const activityParticipants = optionalRows(source.activityParticipants);
			await saveRows(ActivityParticipant, activityParticipants.map((row) => ({ ...row, childId: childId(row.childId) })));
			const pickupRequests = optionalRows(source.pickupRequests);
			await saveRows(PickupRequest, pickupRequests.map((row) => ({
				...row, childId: childId(row.childId), requesterUserId: userId(row.requesterUserId, "pickupRequests.requesterUserId"),
				verifiedByTeacherUserId: userId(row.verifiedByTeacherUserId, "pickupRequests.verifiedByTeacherUserId"),
				expectedTime: new Date(row.expectedTime), decidedAt: row.decidedAt ? new Date(row.decidedAt) : null,
				completedAt: row.completedAt ? new Date(row.completedAt) : null,
			})));
			const notifications = optionalRows(source.notifications);
			await saveRows(Notification, notifications.map((row) => ({
				...row, recipientUserId: userId(row.recipientUserId, "notifications.recipientUserId"),
				senderUserId: userId(row.senderUserId, "notifications.senderUserId"),
				createdAt: new Date(row.createdAt), readAt: row.readAt ? new Date(row.readAt) : null,
			})));
			const imageRows = optionalRows(source.activityImages);
			const imageRoot = resolve(process.env.ACTIVITY_UPLOAD_DIR ?? join(process.cwd(), "uploads", "activities"));
			for (const image of imageRows) {
				if (!isUuid(image.id) || !isUuid(image.activityId)) throw new Error("Activity image IDs must be UUIDs.");
				const parsed = parseMockImage(image);
				const filePath = resolve(imageRoot, parsed.objectKey);
				const rootPrefix = `${imageRoot}${process.platform === "win32" ? "\\" : "/"}`;
				if (!filePath.startsWith(rootPrefix)) throw new Error("Invalid activity image path.");
				await mkdir(join(imageRoot, image.activityId), { recursive: true });
				try { await writeFile(filePath, parsed.buffer, { flag: "wx" }); }
				catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
				await manager.getRepository(ActivityImage).save({
					id: image.id, activityId: image.activityId, objectKey: parsed.objectKey, mimeType: parsed.mimeType, name: image.name ?? null,
				});
			}

			return {
				users: source.users.length,
				classes: source.classes.length,
				children: source.children.length,
				classTeachers: source.classTeachers.length,
				childParents: source.childParents.length,
				attendance: attendance.length, leaveRequests: leaveRequests.length,
				healthRecords: healthRecords.length, allergies: allergies.length, medicalConditions: medicalConditions.length,
				vaccinations: vaccinations.length, medicalVisits: medicalVisits.length,
				activities: activities.length, activityParticipants: activityParticipants.length,
				activityImages: imageRows.length, pickupRequests: pickupRequests.length, notifications: notifications.length,
			};
		});

		console.log("Đã import dữ liệu mock frontend:", counts);
		console.log("Mật khẩu mock mẫu: Password@123");
	} finally {
		await AppDataSource.destroy();
	}
}

void importMockData().catch((error: unknown) => {
	console.error("Import mock data thất bại:", error);
	process.exitCode = 1;
});
