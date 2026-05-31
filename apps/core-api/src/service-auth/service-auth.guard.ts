import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { loadConfig } from '../config/configuration';
import { SERVICE_ONLY_KEY } from './service-only.decorator';

/**
 * Garde service-a-service : verifie le header `x-service-key` contre
 * SERVICE_API_KEY. Comparaison a temps constant pour eviter les fuites par timing.
 *
 * N'agit que sur les routes marquees @ServiceOnly ; sinon laisse passer (la
 * chaine JWT/RBAC s'applique normalement).
 */
@Injectable()
export class ServiceAuthGuard implements CanActivate {
  private readonly expected = Buffer.from(loadConfig().serviceApiKey);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isServiceOnly = this.reflector.getAllAndOverride<boolean>(
      SERVICE_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!isServiceOnly) {
      return true;
    }
    const provided = context.switchToHttp().getRequest().headers[
      'x-service-key'
    ] as string | undefined;
    if (!provided || !this.safeEqual(provided)) {
      throw new UnauthorizedException('Cle de service invalide');
    }
    return true;
  }

  private safeEqual(provided: string): boolean {
    const a = Buffer.from(provided);
    if (a.length !== this.expected.length) {
      return false;
    }
    return timingSafeEqual(a, this.expected);
  }
}
