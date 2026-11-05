import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { DataSource, Not } from 'typeorm';
import { User, type UserRole } from '../users/user.entity';
import { RegistrationRequest } from './registration-request.entity';
import type { CreateRegistrationRequestDto } from './dto/create-registration-request.dto';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

@Injectable()
export class RegistrationRequestsService {
  constructor(private readonly dataSource: DataSource) {}

  async submit(input: CreateRegistrationRequestDto) {
    const email = input.email.trim().toLowerCase();
    const nationalId = input.nationalId.trim();
    const passwordHash = await argon2.hash(input.password);

    try {
      const savedRequest = await this.dataSource.transaction(async (manager) => {
        const requestRepository = manager.getRepository(RegistrationRequest);
        const userRepository = manager.getRepository(User);

        const existingUserByEmail = await userRepository.findOneBy({ email });
        if (existingUserByEmail) {
          throw new ConflictException({
            code: 'EMAIL_EXISTS',
            message: 'Email đã được đăng ký.',
          });
        }

        const existingUserByNationalId = await userRepository.findOneBy({
          nationalId,
        });
        if (existingUserByNationalId) {
          throw new ConflictException({
            code: 'ID_EXISTS',
            message: 'CCCD đã được đăng ký.',
          });
        }

        const existingRequestByEmail = await requestRepository.findOneBy({
          email,
          status: Not('REJECTED'),
        });
        if (existingRequestByEmail) {
          throw new ConflictException({
            code: 'EMAIL_EXISTS',
            message: 'Email đã được dùng trong một yêu cầu chưa bị từ chối.',
          });
        }

        const existingRequestByNationalId = await requestRepository.findOneBy({
          nationalId,
          status: Not('REJECTED'),
        });
        if (existingRequestByNationalId) {
          throw new ConflictException({
            code: 'ID_EXISTS',
            message: 'CCCD đã được dùng trong một yêu cầu chưa bị từ chối.',
          });
        }

        const user = userRepository.create({
          email,
          passwordHash,
          fullName: input.fullName.trim(),
          role: input.role as UserRole,
          status: 'INACTIVE',
          phone: input.phone.trim(),
          nationalId,
        });
        await userRepository.save(user);

        const request = requestRepository.create({
          fullName: input.fullName.trim(),
          email,
          phone: input.phone.trim(),
          role: input.role,
          nationalId,
          status: 'PENDING',
        });

        return requestRepository.save(request);
      });

      return {
        id: savedRequest.id,
        status: savedRequest.status,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'REGISTRATION_CONFLICT',
          message: 'Email hoặc CCCD đã được đăng ký.',
        });
      }

      throw error;
    }
  }

  async list() {
    const requestRepository =
      this.dataSource.getRepository(RegistrationRequest);

    return requestRepository.find({
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        nationalId: true,
        status: true,
        createdAt: true,
        rejectionReason: true,
      },
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
    });
  }

  async reject(id: string, reason: string) {
    return this.dataSource.transaction(async (manager) => {
      const requestRepository = manager.getRepository(RegistrationRequest);
      const userRepository = manager.getRepository(User);
      const request = await requestRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        throw new NotFoundException({
          code: 'REQUEST_NOT_FOUND',
          message: 'Không tìm thấy yêu cầu đăng ký.',
        });
      }

      if (request.status !== 'PENDING') {
        throw new ConflictException({
          code: 'REQUEST_ALREADY_REVIEWED',
          message: 'Chỉ có thể từ chối yêu cầu đang chờ xử lý.',
        });
      }

      const pendingUser = await userRepository.findOneBy({
        email: request.email,
        status: 'INACTIVE',
      });
      if (pendingUser) await userRepository.remove(pendingUser);

      request.status = 'REJECTED';
      request.rejectionReason = reason.trim();
      request.passwordSetupTokenHash = null;
      request.passwordSetupExpiresAt = null;

      const saved = await requestRepository.save(request);

      return {
        id: saved.id,
        status: saved.status,
        rejectionReason: saved.rejectionReason,
      };
    });
  }

  async approve(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const requestRepository = manager.getRepository(RegistrationRequest);
      const userRepository = manager.getRepository(User);
      const request = await requestRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        throw new NotFoundException({
          code: 'REQUEST_NOT_FOUND',
          message: 'Không tìm thấy yêu cầu đăng ký.',
        });
      }

      if (request.status !== 'PENDING') {
        throw new ConflictException({
          code: 'REQUEST_ALREADY_REVIEWED',
          message: 'Chỉ có thể duyệt yêu cầu đang chờ xử lý.',
        });
      }

      const user = await userRepository.findOne({
        where: { email: request.email },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user || user.status !== 'INACTIVE') {
        throw new ConflictException({
          code: 'PENDING_ACCOUNT_NOT_FOUND',
          message:
            'Yêu cầu này được tạo theo luồng cũ. Hãy gửi lại đăng ký với mật khẩu.',
        });
      }

      user.status = 'ACTIVE';
      await userRepository.save(user);

      request.status = 'APPROVED';
      request.rejectionReason = null;
      request.passwordSetupTokenHash = null;
      request.passwordSetupExpiresAt = null;
      const saved = await requestRepository.save(request);

      return {
        id: saved.id,
        status: saved.status,
        email: saved.email,
      };
    });
  }
}
