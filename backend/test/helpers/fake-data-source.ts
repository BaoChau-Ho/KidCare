import { DataSource } from 'typeorm';

/**
 * DataSource giả, dùng thay PostgreSQL thật khi test không cần đọc/ghi dữ liệu.
 * Mặc định `query` trả lời bình thường (database "sống").
 * Truyền `queryError` để giả lập database bị lỗi.
 */
export function createFakeDataSource(options: { queryError?: Error } = {}): DataSource {
  const query = options.queryError
    ? jest.fn().mockRejectedValue(options.queryError)
    : jest.fn().mockResolvedValue([{ '?column?': 1 }]);

  return {
    options: { type: 'postgres' },
    entityMetadatas: [],
    query,
    getRepository: jest.fn().mockReturnValue({}),
  } as unknown as DataSource;
}
