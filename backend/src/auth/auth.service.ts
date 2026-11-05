import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { DataSource, Repository } from 'typeorm';
import { RegistrationRequest } from '../registration-requests/registration-request.entity';
import { User, type UserRole } from '../users/user.entity';
import { LoginDto } from './dto/login.dto';
import { SetPasswordDto } from './dto/set-password.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.usersRepository.findOne({
      where: { email },
    });

    // Không tiết lộ email có tồn tại hay không.
    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không đúng.',
      });
    }

    const passwordIsValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!passwordIsValid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không đúng.',
      });
    }

    if (user.status === 'INACTIVE') {
      throw new ForbiddenException({
        code: 'ACCOUNT_PENDING',
        message: 'Tài khoản đang chờ admin duyệt.',
      });
    }

    if (user.status === 'LOCKED') {
      throw new ForbiddenException({
        code: 'ACCOUNT_DISABLED',
        message: 'Tài khoản đã bị vô hiệu hóa.',
      });
    }

    const token = await this.jwtService.signAsync({
      sub: user.id,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      },
      token,
      expiresIn: 3600,
    };
  }

  async checkSetupToken(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const request = await this.dataSource
      .getRepository(RegistrationRequest)
      .findOneBy({
        passwordSetupTokenHash: tokenHash,
        status: 'APPROVED',
      });

    this.validateSetupRequest(request);

    return { status: 'valid', email: request.email };
  }

  async setPassword(dto: SetPasswordDto) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');

    // Validate before running the comparatively expensive password hash.
    await this.checkSetupToken(dto.token);
    const passwordHash = await argon2.hash(dto.password);

    return this.dataSource.transaction(async (manager) => {
      const requestRepository = manager.getRepository(RegistrationRequest);
      const userRepository = manager.getRepository(User);
      const request = await requestRepository.findOne({
        where: {
          passwordSetupTokenHash: tokenHash,
          status: 'APPROVED',
        },
        lock: { mode: 'pessimistic_write' },
      });

      this.validateSetupRequest(request);

      const emailTaken = await userRepository.findOneBy({
        email: request.email,
      });
      if (emailTaken) {
        throw new ConflictException({
          code: 'EMAIL_EXISTS',
          message: 'Email đã được đăng ký.',
        });
      }

      const nationalIdTaken = await userRepository.findOneBy({
        nationalId: request.nationalId,
      });
      if (nationalIdTaken) {
        throw new ConflictException({
          code: 'ID_EXISTS',
          message: 'CCCD đã được đăng ký.',
        });
      }

      const user = userRepository.create({
        email: request.email,
        passwordHash,
        fullName: request.fullName,
        role: request.role as UserRole,
        status: 'ACTIVE',
        phone: request.phone,
        nationalId: request.nationalId,
      });
      await userRepository.save(user);

      request.status = 'COMPLETED';
      request.passwordSetupTokenHash = null;
      request.passwordSetupExpiresAt = null;
      await requestRepository.save(request);

      return {
        status: 'ok',
        user: {
          id: user.id,
          email: user.email,
        },
      };
    });
  }

  private validateSetupRequest(
    request: RegistrationRequest | null,
  ): asserts request is RegistrationRequest {
    if (!request || !request.passwordSetupExpiresAt) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Link đặt mật khẩu không hợp lệ hoặc đã được sử dụng.',
      });
    }

    if (request.passwordSetupExpiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: 'EXPIRED',
        message: 'Link đặt mật khẩu đã hết hạn.',
      });
    }
  }
}
