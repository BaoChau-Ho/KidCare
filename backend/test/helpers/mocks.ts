import { ExecutionContext, HttpException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

// Đồ giả (mock) dùng chung cho unit test.
// Unit test chỉ kiểm tra một class; repository, DataSource, JwtService... đều được thay bằng jest.fn().

export type RepositoryMock = {
  find: jest.Mock;
  findOne: jest.Mock;
  findOneBy: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
};

/** Repository giả: mặc định không tìm thấy gì, `create` trả lại dữ liệu, `save` trả lại entity. */
export function createRepositoryMock(): RepositoryMock {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    create: jest.fn((data: object) => ({ ...data })),
    save: jest.fn(async (entity: object) => entity),
    remove: jest.fn(async (entity: object) => entity),
  };
}

/**
 * DataSource giả. `repositories` ghép entity với repository giả của nó.
 * `transaction(cb)` chạy luôn callback với một manager giả dùng chung các repository đó.
 */
export function createDataSourceMock(
  repositories: Map<unknown, RepositoryMock>,
) {
  const getRepository = jest.fn((entity: unknown) => {
    const repository = repositories.get(entity);
    if (!repository) {
      throw new Error('Chưa giả lập repository cho entity này');
    }
    return repository;
  });
  const manager = { getRepository };
  const transaction = jest.fn(async (work: (m: typeof manager) => unknown) =>
    work(manager),
  );

  return { getRepository, transaction, manager };
}

/** ExecutionContext giả cho guard: chỉ cần trả về request. */
export function createHttpContext(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

/** Chạy `action` và trả về lỗi nó ném ra. Báo lỗi nếu không có lỗi nào. */
export async function getError(action: () => unknown): Promise<unknown> {
  try {
    await action();
  } catch (error) {
    return error;
  }
  throw new Error('Mong đợi có lỗi nhưng không có lỗi nào được ném ra');
}

/** Kiểm tra lỗi là exception HTTP đúng loại và đúng mã `code` trong response. */
export function expectHttpError(
  error: unknown,
  type: new (...args: never[]) => HttpException,
  code: string,
): void {
  expect(error).toBeInstanceOf(type);
  expect((error as HttpException).getResponse()).toMatchObject({ code });
}

/** Chạy validation của DTO như ValidationPipe và trả về tên các trường bị lỗi. */
export async function invalidFields<T extends object>(
  dto: new () => T,
  input: object,
): Promise<string[]> {
  const errors = await validate(plainToInstance(dto, input));
  return errors.map((error) => error.property);
}
