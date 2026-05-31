import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '@alpha/domain';
import { PermissionsGuard } from './permissions.guard';

/** Construit un ExecutionContext minimal portant un utilisateur donne. */
function contextWithUser(user: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('PermissionsGuard', () => {
  it('laisse passer si aucune permission requise', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(contextWithUser({ permissions: [] }))).toBe(true);
  });

  it('autorise quand l utilisateur possede toutes les permissions', () => {
    const reflector = {
      getAllAndOverride: () => [Permission.CALLS_READ],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const ctx = contextWithUser({ permissions: [Permission.CALLS_READ] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('refuse quand une permission manque', () => {
    const reflector = {
      getAllAndOverride: () => [Permission.USERS_MANAGE],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const ctx = contextWithUser({ permissions: [Permission.CALLS_READ] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('refuse en l absence d utilisateur', () => {
    const reflector = {
      getAllAndOverride: () => [Permission.CALLS_READ],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
