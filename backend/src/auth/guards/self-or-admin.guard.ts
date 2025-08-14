import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';

@Injectable()
export class SelfOrAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as { id?: number; role?: Role } | undefined;
    const paramId = Number(req.params?.id);

    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    if (!Number.isNaN(paramId) && user.id === paramId) return true;

    return false;
  }
}
