import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@alpha/domain';

/** Cle de metadonnee portant les permissions requises pour une route. */
export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Decorateur : exige une ou plusieurs permissions (toutes requises) pour acceder
 * a la route. A utiliser avec PermissionsGuard.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
