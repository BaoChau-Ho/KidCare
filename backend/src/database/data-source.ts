import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'user',
  password: process.env.DB_PASSWORD ?? 'password',
  database: process.env.DB_DATABASE ?? 'mydb',
  entities: ['src/**/*.entity{.ts,.js}'],
  migrations: ['src/database/migrations/*{.ts,.js}'],
  synchronize: false,
  extra: { connectionTimeoutMillis: 3000 },
});
