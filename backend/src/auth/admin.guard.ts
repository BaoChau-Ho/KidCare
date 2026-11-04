import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './jwt-auth.guard';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request =
      context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.user.role !== 'admin') {
      throw new ForbiddenException({
        code: 'ADMIN_ONLY',
        message: 'Chỉ admin mới có quyền thực hiện thao tác này.',
      });
    }

    return true;
  }
}