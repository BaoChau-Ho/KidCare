/**
 * Nạp dữ liệu thử để test tay qua giao diện: 7 tài khoản, 2 lớp, 4 trẻ đã liên kết phụ huynh và giáo viên.
 *
 *   npm run seed:demo
 *
 * - Chạy lại nhiều lần được: bản ghi nào đã có thì giữ nguyên, chỉ thêm phần còn thiếu.
 * - Mật khẩu chung của mọi tài khoản demo: Password@123 (băm argon2 giống AuthService).
 *   Tài khoản đã tồn tại thì KHÔNG bị đổi mật khẩu, trừ khi đặt SEED_RESET_PASSWORDS=true.
 * - Từ chối chạy khi NODE_ENV=production.
 */
import 'dotenv/config';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import { ChildParent } from '../../children/child-parent.entity';
import { Child } from '../../children/child.entity';
import { ClassTeacher } from '../../classes/class-teacher.entity';
import { Classroom } from '../../classes/class.entity';
import { User, type UserRole } from '../../users/user.entity';

const PASSWORD = 'Password@123';
const ACADEMIC_YEAR = '2026-2027';

interface UserSpec {
	email: string;
	fullName: string;
	role: UserRole;
	phone: string;
	nationalId: string;
}

const USERS: UserSpec[] = [
	{ email: 'admin@demo.com', fullName: 'Quản trị viên', role: 'ADMIN', phone: '0900000001', nationalId: '001000000001' },
	{ email: 'manager@demo.com', fullName: 'Trần Thị Quản Lý', role: 'MANAGER', phone: '0900000002', nationalId: '001000000002' },
	{ email: 'teacher@demo.com', fullName: 'Nguyễn Thu Hà', role: 'TEACHER', phone: '0900000003', nationalId: '001000000003' },
	{ email: 'chau.teacher@demo.com', fullName: 'Lê Minh Châu', role: 'TEACHER', phone: '0900000004', nationalId: '001000000004' },
	{ email: 'medical@demo.com', fullName: 'Võ Thanh Y Tế', role: 'MEDICAL_STAFF', phone: '0900000006', nationalId: '001000000006' },
	{ email: 'parent@demo.com', fullName: 'Nguyễn Văn Phụ', role: 'PARENT', phone: '0900000007', nationalId: '001000000007' },
	{ email: 'parent2@demo.com', fullName: 'Đỗ Thị Mai', role: 'PARENT', phone: '0900000008', nationalId: '001000000008' },
];

const CLASSES = [{ name: 'Lớp Mầm 1' }, { name: 'Lớp Chồi 1' }];

const CHILDREN = [
	{ name: 'Nguyễn Minh An', dateOfBirth: '2022-03-14', gender: 'MALE', address: '12 Láng Hạ, Hà Nội', className: 'Lớp Mầm 1', parent: 'parent@demo.com', relationship: 'FATHER' },
	{ name: 'Đỗ Gia Huy', dateOfBirth: '2022-01-20', gender: 'MALE', address: '45 Kim Mã, Hà Nội', className: 'Lớp Mầm 1', parent: 'parent2@demo.com', relationship: 'MOTHER' },
	{ name: 'Nguyễn Bảo Châu', dateOfBirth: '2021-07-02', gender: 'FEMALE', address: '12 Láng Hạ, Hà Nội', className: 'Lớp Chồi 1', parent: 'parent@demo.com', relationship: 'FATHER' },
	{ name: 'Đỗ Khánh Linh', dateOfBirth: '2021-11-09', gender: 'FEMALE', address: '45 Kim Mã, Hà Nội', className: 'Lớp Chồi 1', parent: 'parent2@demo.com', relationship: 'MOTHER' },
] as const;

// Giáo viên phụ trách lớp
const ASSIGNMENTS = [
	{ teacher: 'teacher@demo.com', className: 'Lớp Mầm 1' },
	{ teacher: 'chau.teacher@demo.com', className: 'Lớp Chồi 1' },
];

async function main() {
	if (process.env.NODE_ENV === 'production') {
		throw new Error('Không chạy seed dữ liệu thử trên môi trường production.');
	}

	const dataSource = new DataSource({
		type: 'postgres',
		host: process.env.DB_HOST ?? 'localhost',
		port: Number(process.env.DB_PORT ?? 5432),
		username: process.env.DB_USERNAME ?? 'user',
		password: process.env.DB_PASSWORD ?? 'password',
		database: process.env.DB_DATABASE ?? 'mydb',
		uuidExtension: 'pgcrypto',
		entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
		synchronize: false,
	});
	await dataSource.initialize();
	const resetPasswords = process.env.SEED_RESET_PASSWORDS === 'true';
	const passwordHash = await argon2.hash(PASSWORD);
	const log: string[] = [];

	try {
		await dataSource.transaction(async (manager) => {
			const users = manager.getRepository(User);
			const classes = manager.getRepository(Classroom);
			const children = manager.getRepository(Child);
			const links = manager.getRepository(ChildParent);
			const assignments = manager.getRepository(ClassTeacher);

			const userByEmail = new Map<string, User>();
			for (const spec of USERS) {
				let user = await users.findOneBy({ email: spec.email });
				if (!user) {
					user = await users.save(users.create({
						email: spec.email,
						passwordHash,
						fullName: spec.fullName,
						role: spec.role,
						status: 'ACTIVE',
						phone: spec.phone,
						nationalId: spec.nationalId,
					}));
					log.push(`+ tài khoản ${spec.email} (${spec.role})`);
				} else {
					const changes: string[] = [];
					if (user.role !== spec.role) { user.role = spec.role; changes.push('vai trò'); }
					if (user.status !== 'ACTIVE') { user.status = 'ACTIVE'; changes.push('kích hoạt lại'); }
					if (resetPasswords) { user.passwordHash = passwordHash; changes.push('mật khẩu'); }
					if (changes.length) await users.save(user);
					log.push(`= tài khoản ${spec.email} đã có${changes.length ? ` (đã cập nhật: ${changes.join(', ')})` : ', giữ nguyên'}`);
				}
				userByEmail.set(spec.email, user);
			}

			const classByName = new Map<string, Classroom>();
			for (const spec of CLASSES) {
				let classroom = await classes.findOneBy({ name: spec.name, academicYear: ACADEMIC_YEAR });
				if (!classroom) {
					classroom = await classes.save(classes.create({ name: spec.name, academicYear: ACADEMIC_YEAR, status: 'ACTIVE' }));
					log.push(`+ lớp ${spec.name} (${ACADEMIC_YEAR})`);
				}
				classByName.set(spec.name, classroom);
			}

			for (const spec of ASSIGNMENTS) {
				const classroom = classByName.get(spec.className)!;
				const teacher = userByEmail.get(spec.teacher)!;
				if (!(await assignments.exist({ where: { classId: classroom.id, teacherUserId: teacher.id } }))) {
					await assignments.save(assignments.create({ classId: classroom.id, teacherUserId: teacher.id }));
					log.push(`+ phân công ${spec.teacher} -> ${spec.className}`);
				}
			}

			for (const spec of CHILDREN) {
				const classroom = classByName.get(spec.className)!;
				let child = await children.findOneBy({ name: spec.name, classId: classroom.id });
				if (!child) {
					child = await children.save(children.create({
						name: spec.name,
						dateOfBirth: spec.dateOfBirth,
						gender: spec.gender,
						address: spec.address,
						avatarUrl: null,
						classId: classroom.id,
						status: 'ACTIVE',
					}));
					log.push(`+ trẻ ${spec.name} (${spec.className})`);
				}
				const parent = userByEmail.get(spec.parent)!;
				if (!(await links.exist({ where: { childId: child.id, parentUserId: parent.id } }))) {
					await links.save(links.create({ childId: child.id, parentUserId: parent.id, relationship: spec.relationship }));
					log.push(`+ liên kết ${spec.parent} -> ${spec.name} (${spec.relationship})`);
				}
			}
		});
	} finally {
		await dataSource.destroy();
	}

	console.log(log.join('\n'));
	console.log(`\nXong. Đăng nhập bằng email trong danh sách, mật khẩu chung: ${PASSWORD}`);
	console.log('  manager@demo.com         Quản lý cơ sở');
	console.log('  teacher@demo.com         Giáo viên lớp Mầm 1 (An, Huy)');
	console.log('  chau.teacher@demo.com    Giáo viên lớp Chồi 1 (Bảo Châu, Khánh Linh)');
	console.log('  parent@demo.com          Phụ huynh của An và Bảo Châu');
	console.log('  parent2@demo.com         Phụ huynh của Huy và Khánh Linh');
	console.log('  medical@demo.com, admin@demo.com');
}

main().catch((error: unknown) => {
	console.error('Seed lỗi:', error instanceof Error ? error.message : error);
	process.exit(1);
});