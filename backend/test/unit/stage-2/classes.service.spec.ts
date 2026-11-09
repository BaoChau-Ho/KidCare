import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, getMetadataArgsStorage, Repository } from 'typeorm';
import {
  createDataSourceMock,
  createQueryBuilderMock,
  createRepositoryMock,
  expectHttpError,
  getError,
  invalidFields,
  RepositoryMock,
  whereClauses,
} from '../../helpers/mocks';
import { AuditLogsService } from '../../../src/audit-logs/audit-logs.service';
import { Child } from '../../../src/children/child.entity';
import { ClassTeacher } from '../../../src/classes/class-teacher.entity';
import { Classroom } from '../../../src/classes/class.entity';
import { ClassesService } from '../../../src/classes/classes.service';
import { AssignTeachersDto } from '../../../src/classes/dto/assign-teachers.dto';
import { ListClassesQueryDto } from '../../../src/classes/dto/list-classes-query.dto';
import { User } from '../../../src/users/user.entity';

// Giai đoạn 2 — UC-05 quản lý lớp và phân công giáo viên.
// Danh sách test và tiến độ: backend/test/README.md.

const MANAGER = { id: 'm0000000-0000-4000-8000-000000000001', email: 'manager@demo.com', fullName: 'Quản lý', role: 'MANAGER' as const };
const CLASS_ID = 'c0000000-0000-4000-8000-000000000001';
const TEACHER_ID = 't0000000-0000-4000-8000-000000000001';
const IP = '10.0.0.1';

const makeClass = (overrides: Partial<Classroom> = {}): Classroom => ({
  id: CLASS_ID,
  name: 'Lá 1',
  academicYear: '2026-2027',
  status: 'ACTIVE',
  createdAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date('2026-11-01T00:00:00Z'),
  ...overrides,
});

const makeTeacher = (overrides: Partial<User> = {}) =>
  ({ id: TEACHER_ID, email: 'teacher@demo.com', fullName: 'Cô A', role: 'TEACHER', status: 'ACTIVE', ...overrides }) as User;

describe('GĐ2 · ClassesService', () => {
  let classes: RepositoryMock;
  let assignments: RepositoryMock;
  let children: RepositoryMock;
  let users: RepositoryMock;
  let auditLogs: { record: jest.Mock };
  let service: ClassesService;

  beforeEach(() => {
    classes = createRepositoryMock();
    classes.save.mockImplementation(async (c: Classroom) => Object.assign({ id: CLASS_ID }, c));
    assignments = createRepositoryMock();
    children = createRepositoryMock();
    users = createRepositoryMock();
    auditLogs = { record: jest.fn().mockResolvedValue(undefined) };
    const dataSource = createDataSourceMock(
      new Map<unknown, RepositoryMock>([
        [Classroom, classes],
        [ClassTeacher, assignments],
        [Child, children],
        [User, users],
      ]),
    );
    service = new ClassesService(
      classes as unknown as Repository<Classroom>,
      assignments as unknown as Repository<ClassTeacher>,
      children as unknown as Repository<Child>,
      dataSource as unknown as DataSource,
      auditLogs as unknown as AuditLogsService,
    );
  });

  describe('create', () => {
    it('UT-CLASS-01 tạo lớp hợp lệ → trạng thái hoạt động, chưa có giáo viên / trẻ, ghi audit log', async () => {
      const result = await service.create({ name: 'Lá 1', academicYear: '2026-2027' }, MANAGER, IP);

      expect(result).toEqual({
        id: CLASS_ID,
        name: 'Lá 1',
        academicYear: '2026-2027',
        status: 'ACTIVE',
        teacherUserIds: [],
        teachers: [],
        childCount: 0,
      });
      expect(auditLogs.record.mock.calls[0][1]).toMatchObject({ action: 'CREATE_CLASS', resourceId: CLASS_ID, ipAddress: IP });
    });

    it.each(['ADMIN', 'TEACHER', 'PARENT', 'MEDICAL_STAFF'] as const)(
      'UT-CLASS-01b vai trò %s không được tạo lớp → 403',
      async (role) => {
        expectHttpError(
          await getError(() => service.create({ name: 'Lá 1', academicYear: '2026-2027' }, { ...MANAGER, role }, IP)),
          ForbiddenException,
          'MANAGER_ONLY',
        );
        expect(classes.save).not.toHaveBeenCalled();
      },
    );

    it('UT-CLASS-02 trùng tên trong cùng năm học (unique violation) → 409', async () => {
      classes.save.mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505' }));
      expectHttpError(
        await getError(() => service.create({ name: 'Lá 1', academicYear: '2026-2027' }, MANAGER, IP)),
        ConflictException,
        'CLASS_ALREADY_EXISTS',
      );
    });

    it('UT-CLASS-03 ràng buộc duy nhất gồm cả tên và năm học → trùng tên khác năm học vẫn hợp lệ', () => {
      const index = getMetadataArgsStorage().indices.find((i) => i.target === Classroom && i.unique);
      expect(index?.columns).toEqual(['name', 'academicYear']);
    });
  });

  describe('update (đóng lớp)', () => {
    beforeEach(() => classes.findOne.mockResolvedValue(makeClass()));

    it('UT-CLASS-04 đóng lớp còn trẻ đang học → 409, không lưu, không ghi audit', async () => {
      children.countBy.mockResolvedValue(2);
      expectHttpError(
        await getError(() => service.update(CLASS_ID, { status: 'CLOSED' }, MANAGER, IP)),
        ConflictException,
        'CLASS_HAS_ACTIVE_CHILDREN',
      );
      expect(children.countBy).toHaveBeenCalledWith({ classId: CLASS_ID, status: 'ACTIVE' });
      expect(classes.save).not.toHaveBeenCalled();
      expect(auditLogs.record).not.toHaveBeenCalled();
    });

    it('UT-CLASS-05 đóng lớp không còn trẻ → thành công, audit log ghi CLOSE_CLASS', async () => {
      const result = await service.update(CLASS_ID, { status: 'CLOSED' }, MANAGER, IP);
      expect(result.status).toBe('CLOSED');
      expect(auditLogs.record.mock.calls[0][1]).toMatchObject({
        action: 'CLOSE_CLASS',
        oldValue: { status: 'ACTIVE' },
        newValue: { status: 'CLOSED' },
      });
    });

    it('UT-CLASS-05b cập nhật rỗng → 400; lớp không tồn tại → 404', async () => {
      expectHttpError(await getError(() => service.update(CLASS_ID, {}, MANAGER, IP)), BadRequestException, 'EMPTY_UPDATE');
      classes.findOne.mockResolvedValue(null);
      expectHttpError(await getError(() => service.update(CLASS_ID, { name: 'Lá 2' }, MANAGER, IP)), NotFoundException, 'CLASS_NOT_FOUND');
    });
  });

  describe('assignTeachers / removeTeacher', () => {
    beforeEach(() => classes.findOneBy.mockResolvedValue(makeClass()));

    it.each([
      ['không phải giáo viên', [makeTeacher({ role: 'PARENT' })]],
      ['giáo viên bị khóa', [makeTeacher({ status: 'LOCKED' })]],
      ['tài khoản không tồn tại', []],
    ])('UT-CLASS-06 phân công %s → 400 INVALID_TEACHER, không lưu', async (_case, found) => {
      users.findBy.mockResolvedValue(found);
      expectHttpError(
        await getError(() => service.assignTeachers(CLASS_ID, { teacherUserIds: [TEACHER_ID] }, MANAGER, IP)),
        BadRequestException,
        'INVALID_TEACHER',
      );
      expect(assignments.save).not.toHaveBeenCalled();
    });

    it('UT-CLASS-07 phân công giáo viên đã có trong lớp → 409, không tạo bản ghi trùng', async () => {
      users.findBy.mockResolvedValue([makeTeacher()]);
      assignments.findBy.mockResolvedValue([{ classId: CLASS_ID, teacherUserId: TEACHER_ID }]);
      expectHttpError(
        await getError(() => service.assignTeachers(CLASS_ID, { teacherUserIds: [TEACHER_ID] }, MANAGER, IP)),
        ConflictException,
        'ASSIGNMENT_EXISTS',
      );
      expect(assignments.save).not.toHaveBeenCalled();
    });

    it('UT-CLASS-07b một request gửi trùng id giáo viên → DTO từ chối (400)', async () => {
      expect(await invalidFields(AssignTeachersDto, { teacherUserIds: [TEACHER_ID, TEACHER_ID] })).toEqual(['teacherUserIds']);
      expect(await invalidFields(AssignTeachersDto, { teacherUserIds: [] })).toEqual(['teacherUserIds']);
    });

    it('UT-CLASS-07c phân công hợp lệ → lưu và audit log ghi danh sách cũ / mới', async () => {
      users.findBy.mockResolvedValue([makeTeacher()]);
      const result = await service.assignTeachers(CLASS_ID, { teacherUserIds: [TEACHER_ID] }, MANAGER, IP);
      expect(result).toEqual([{ classId: CLASS_ID, teacherUserId: TEACHER_ID }]);
      expect(auditLogs.record.mock.calls[0][1]).toMatchObject({
        action: 'ASSIGN_TEACHER',
        oldValue: { teacherUserIds: [] },
        newValue: { teacherUserIds: [TEACHER_ID] },
      });
    });

    it('UT-CLASS-07d phân công vào lớp đã đóng → 409 CLASS_CLOSED', async () => {
      classes.findOneBy.mockResolvedValue(makeClass({ status: 'CLOSED' }));
      expectHttpError(
        await getError(() => service.assignTeachers(CLASS_ID, { teacherUserIds: [TEACHER_ID] }, MANAGER, IP)),
        ConflictException,
        'CLASS_CLOSED',
      );
    });

    it('UT-CLASS-08 gỡ giáo viên không có trong lớp → 404; lớp không tồn tại → 404', async () => {
      expectHttpError(
        await getError(() => service.removeTeacher(CLASS_ID, TEACHER_ID, MANAGER, IP)),
        NotFoundException,
        'ASSIGNMENT_NOT_FOUND',
      );
      expect(assignments.remove).not.toHaveBeenCalled();

      classes.findOneBy.mockResolvedValue(null);
      expectHttpError(
        await getError(() => service.removeTeacher(CLASS_ID, TEACHER_ID, MANAGER, IP)),
        NotFoundException,
        'CLASS_NOT_FOUND',
      );
    });
  });

  describe('list / getOne', () => {
    const query = (overrides: Partial<ListClassesQueryDto> = {}) => Object.assign(new ListClassesQueryDto(), overrides);

    it('UT-CLASS-09 danh sách lớp có phân trang và lọc theo năm học (đã trim)', async () => {
      const qb = createQueryBuilderMock([makeClass()], 7);
      classes.createQueryBuilder.mockReturnValue(qb);

      const result = await service.list(query({ academicYear: ' 2026-2027 ', status: 'ACTIVE', page: 2, limit: 5 }), MANAGER);

      expect(whereClauses(qb)).toContain('"academicYear":"2026-2027"');
      expect(whereClauses(qb)).toContain('"status":"ACTIVE"');
      expect(qb.skip).toHaveBeenCalledWith(5);
      expect(qb.take).toHaveBeenCalledWith(5);
      expect(result.pageInfo).toEqual({ page: 2, limit: 5, totalItems: 7, totalPages: 2 });
    });

    it('UT-CLASS-09b giáo viên chỉ thấy lớp mình được phân công', async () => {
      const qb = createQueryBuilderMock();
      classes.createQueryBuilder.mockReturnValue(qb);
      await service.list(query(), { ...MANAGER, id: TEACHER_ID, role: 'TEACHER' });
      expect(qb.innerJoin).toHaveBeenCalledWith(ClassTeacher, 'assignment', expect.any(String), { teacherId: TEACHER_ID });
    });

    it.each(['ADMIN', 'PARENT', 'MEDICAL_STAFF'] as const)('UT-CLASS-09c vai trò %s không xem được danh sách lớp → 403', async (role) => {
      expectHttpError(await getError(() => service.list(query(), { ...MANAGER, role })), ForbiddenException, 'CLASS_ACCESS_DENIED');
    });

    it('UT-CLASS-09d giáo viên mở lớp không được phân công → 403; được phân công → xem được', async () => {
      classes.findOneBy.mockResolvedValue(makeClass());
      const teacher = { ...MANAGER, id: TEACHER_ID, role: 'TEACHER' as const };

      expectHttpError(await getError(() => service.getOne(CLASS_ID, teacher)), ForbiddenException, 'CLASS_ACCESS_DENIED');
      assignments.exist.mockResolvedValue(true);
      await expect(service.getOne(CLASS_ID, teacher)).resolves.toMatchObject({ id: CLASS_ID });
    });
  });
});
