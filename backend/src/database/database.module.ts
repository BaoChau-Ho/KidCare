import { Global, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Global()
@Module({
  providers: [
    {
      provide: DataSource,
      useFactory: async () =>
        new DataSource({
          type: 'postgres',
          host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? 5432),
          username: process.env.DB_USERNAME ?? 'user',
          password: process.env.DB_PASSWORD ?? 'password',
          database: process.env.DB_DATABASE ?? 'mydb',
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          synchronize: false,
          extra: { connectionTimeoutMillis: 3000 },
        }).initialize(),
    },
  ],
  exports: [DataSource],
})
export class DatabaseModule {}
