import 'dotenv/config';
import * as argon2 from 'argon2';
import AppDataSource from '../database/data-source';
import { User } from './user.entity';

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_FULL_NAME?.trim() || 'KidCare Admin';

  if (!email || !password) {
    throw new Error('Cần khai báo ADMIN_EMAIL và ADMIN_PASSWORD trong backend/.env');
  }

  await AppDataSource.initialize();

  try {
    const usersRepository = AppDataSource.getRepository(User);
    const existingUser = await usersRepository.findOne({ where: { email } });

    if (existingUser) {
      console.log(`Tài khoản ${email} đã tồn tại; không thay đổi tài khoản.`);
      return;
    }

    const passwordHash = await argon2.hash(password);

    const admin = usersRepository.create({
      email,
      passwordHash,
      fullName,
      role: 'admin',
      status: 'active',
      phone: null,
      nationalId: null,
    });

    await usersRepository.save(admin);
    console.log(`Đã tạo admin: ${email}`);
  } finally {
    await AppDataSource.destroy();
  }
}

seedAdmin().catch((error: unknown) => {
  console.error('Không tạo được admin:', error);
  process.exitCode = 1;
});