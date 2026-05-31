import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser, Permission } from '@alpha/domain';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

/**
 * Garde RBAC : verifie que l'utilisateur courant possede TOUTES les permissions
 * requises par la route (declarees via @RequirePermissions).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }
    const user = context.switchToHttp().getRequest()
      .user as AuthenticatedUser | undefined;
    if (!user) {
      throw new ForbiddenException('Acces refuse');
    }
    const granted = new Set(user.permissions);
    const missing = required.filter((p) => !granted.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Permission(s) manquante(s) : ${missing.join(', ')}`,
      );
    }
    return true;
  }
}
