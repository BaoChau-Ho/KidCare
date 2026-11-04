import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

export type AuthenticatedRequest = Request & {
  user: Pick<User, 'id' | 'email' | 'fullName' | 'role' | 'status'>;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;
    const [scheme, token] = authorization?.split(' ') ?? [];

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException({
        code: 'MISSING_TOKEN',
        message: 'Cần gửi access token để truy cập.',
      });
    }

    let payload: { sub: number };

    try {
      payload = await this.jwtService.verifyAsync<{ sub: number }>(token);

      if (!Number.isInteger(payload.sub)) {
        throw new Error('JWT thiếu user id');
      }
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Token không hợp lệ hoặc đã hết hạn.',
      });
    }

    const user = await this.usersRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException({
        code: 'ACCOUNT_INACTIVE',
        message: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.',
      });
    }

    // Chỉ gắn các trường được phép trả ra; không đưa passwordHash vào request.
    request.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
    };

    return true;
  }
}