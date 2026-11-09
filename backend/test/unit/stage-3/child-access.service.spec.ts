import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createDataSourceMock, createRepositoryMock, expectHttpError, getError, RepositoryMock } from '../../helpers/mocks';
import { AccessActor, ChildAccessService } from '../../../src/access/child-access.service';
import { ChildParent } from '../../../src/children/child-parent.entity';
import { ClassTeacher } from '../../../src/classes/class-teacher.entity';

// Giai đoạn 3 — kiểm tra "dữ liệu này có thuộc về người đang hỏi không" (chống IDOR), dùng chung cho UC-06, UC-07, UC-08.
// Danh sách test và tiến độ: backend/test/README.md.

const CLASS_ID = 'c0000000-0000-4000-8000-000000000001';
const CHILD = { id: 'k0000000-0000-4000-8000-000000000001', classId: CLASS_ID };

const actor = (role: AccessActor['role'], id = 'u0000000-0000-4000-8000-000000000001'): AccessActor => ({
  id,
  email: `${role.toLowerCase()}@demo.com`,
  fullName: role,
  role,
});

describe('GĐ3 · ChildAccessService', () => {
  let assignments: RepositoryMock;
  let links: RepositoryMock;
  let dataSource: ReturnType<typeof createDataSourceMock>;
  let service: ChildAccessService;

  beforeEach(() => {
    assignments = createRepositoryMock();
    links = createRepositoryMock();
    dataSource = createDataSourceMock(
      new Map<unknown, RepositoryMock>([
        [ClassTeacher, assignments],
        [ChildParent, links],
      ]),
    );
    service = new ChildAccessService(dataSource as unknown as DataSource);
  });

  describe('assertRole', () => {
    it('UT-ACCESS-01 vai trò nằm trong danh sách → cho qua; ngoài danh sách → 403 ROLE_NOT_ALLOWED kèm thông điệp', async () => {
      expect(() => service.assertRole(actor('TEACHER'), ['TEACHER', 'MANAGER'], 'x')).not.toThrow();
      const error = await getError(() => service.assertRole(actor('PARENT'), ['TEACHER', 'MANAGER'], 'Chỉ giáo viên.'));
      expectHttpError(error, ForbiddenException, 'ROLE_NOT_ALLOWED');
      expect((error as ForbiddenException).getResponse()).toMatchObject({ message: 'Chỉ giáo viên.' });
    });
  });

  describe('assertCanAccessClass', () => {
    it('UT-ACCESS-02 quản lý vào được mọi lớp, không cần tra phân công', async () => {
      await expect(service.assertCanAccessClass(CLASS_ID, actor('MANAGER'))).resolves.toBeUndefined();
      expect(assignments.exist).not.toHaveBeenCalled();
    });

    it('UT-ACCESS-03 giáo viên được phân công → cho qua; tra đúng cặp (lớp, giáo viên)', async () => {
      const teacher = actor('TEACHER', 't0000000-0000-4000-8000-000000000001');
      assignments.exist.mockResolvedValue(true);
      await expect(service.assertCanAccessClass(CLASS_ID, teacher)).resolves.toBeUndefined();
      expect(assignments.exist).toHaveBeenCalledWith({ where: { classId: CLASS_ID, teacherUserId: teacher.id } });
    });

    it('UT-ACCESS-04 giáo viên không được phân công → 403 CLASS_ACCESS_DENIED', async () => {
      assignments.exist.mockResolvedValue(false);
      expectHttpError(await getError(() => service.assertCanAccessClass(CLASS_ID, actor('TEACHER'))), ForbiddenException, 'CLASS_ACCESS_DENIED');
    });

    it.each(['PARENT', 'MEDICAL_STAFF', 'ADMIN'] as const)(
      'UT-ACCESS-05 vai trò %s → 403 CLASS_ACCESS_DENIED, kể cả khi có dòng phân công trùng id',
      async (role) => {
        assignments.exist.mockResolvedValue(true);
        expectHttpError(await getError(() => service.assertCanAccessClass(CLASS_ID, actor(role))), ForbiddenException, 'CLASS_ACCESS_DENIED');
      },
    );

    it('UT-ACCESS-06 trong transaction: tra phân công bằng manager được truyền vào, không dùng kết nối ngoài', async () => {
      const txRepo = createRepositoryMock();
      txRepo.exist.mockResolvedValue(true);
      const tx = { getRepository: jest.fn(() => txRepo) };
      await service.assertCanAccessClass(CLASS_ID, actor('TEACHER'), tx as never);
      expect(txRepo.exist).toHaveBeenCalled();
      expect(assignments.exist).not.toHaveBeenCalled();
    });
  });

  describe('assertCanViewChild', () => {
    it('UT-ACCESS-07 quản lý xem được mọi trẻ', async () => {
      await expect(service.assertCanViewChild(CHILD, actor('MANAGER'))).resolves.toBeUndefined();
    });

    it('UT-ACCESS-08 giáo viên của lớp chứa trẻ xem được; giáo viên lớp khác → 403 CHILD_ACCESS_DENIED', async () => {
      assignments.exist.mockResolvedValueOnce(true);
      await expect(service.assertCanViewChild(CHILD, actor('TEACHER'))).resolves.toBeUndefined();
      expect(assignments.exist).toHaveBeenLastCalledWith({ where: { classId: CLASS_ID, teacherUserId: expect.any(String) } });

      assignments.exist.mockResolvedValueOnce(false);
      expectHttpError(await getError(() => service.assertCanViewChild(CHILD, actor('TEACHER'))), ForbiddenException, 'CHILD_ACCESS_DENIED');
    });

    it('UT-ACCESS-09 phụ huynh đã liên kết xem được; phụ huynh khác (đổi id trên URL) → 403', async () => {
      const parent = actor('PARENT', 'p0000000-0000-4000-8000-000000000001');
      links.exist.mockResolvedValueOnce(true);
      await expect(service.assertCanViewChild(CHILD, parent)).resolves.toBeUndefined();
      expect(links.exist).toHaveBeenLastCalledWith({ where: { childId: CHILD.id, parentUserId: parent.id } });

      links.exist.mockResolvedValueOnce(false);
      expectHttpError(await getError(() => service.assertCanViewChild(CHILD, parent)), ForbiddenException, 'CHILD_ACCESS_DENIED');
    });

    it('UT-ACCESS-10 giáo viên không được coi là phụ huynh (không tra bảng liên kết phụ huynh)', async () => {
      assignments.exist.mockResolvedValue(false);
      links.exist.mockResolvedValue(true);
      expectHttpError(await getError(() => service.assertCanViewChild(CHILD, actor('TEACHER'))), ForbiddenException, 'CHILD_ACCESS_DENIED');
      expect(links.exist).not.toHaveBeenCalled();
    });

    it.each(['MEDICAL_STAFF', 'ADMIN'] as const)('UT-ACCESS-11 vai trò %s không xem được điểm danh của trẻ → 403', async (role) => {
      assignments.exist.mockResolvedValue(true);
      links.exist.mockResolvedValue(true);
      expectHttpError(await getError(() => service.assertCanViewChild(CHILD, actor(role))), ForbiddenException, 'CHILD_ACCESS_DENIED');
    });
  });

  describe('assertIsParentOf', () => {
    it('UT-ACCESS-12 chỉ phụ huynh đã liên kết qua được; quản lý và giáo viên cũng bị chặn', async () => {
      links.exist.mockResolvedValue(true);
      await expect(service.assertIsParentOf(CHILD.id, actor('PARENT'))).resolves.toBeUndefined();
      for (const role of ['MANAGER', 'TEACHER'] as const) {
        expectHttpError(await getError(() => service.assertIsParentOf(CHILD.id, actor(role))), ForbiddenException, 'CHILD_ACCESS_DENIED');
      }
      links.exist.mockResolvedValue(false);
      expectHttpError(await getError(() => service.assertIsParentOf(CHILD.id, actor('PARENT'))), ForbiddenException, 'CHILD_ACCESS_DENIED');
    });
  });

  describe('teacherClassIds', () => {
    it('UT-ACCESS-13 trả id các lớp giáo viên được phân công', async () => {
      assignments.findBy.mockResolvedValue([{ classId: 'a' }, { classId: 'b' }]);
      await expect(service.teacherClassIds('t1')).resolves.toEqual(['a', 'b']);
      expect(assignments.findBy).toHaveBeenCalledWith({ teacherUserId: 't1' });
    });
  });
});
