import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ServiceAuthGuard } from './service-auth.guard';

function ctxWithHeader(key?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: key ? { 'x-service-key': key } : {} }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('ServiceAuthGuard', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32).toString('base64');
    process.env.DATABASE_URL = 'postgresql://test';
    process.env.JWT_ACCESS_SECRET = 'a';
    process.env.JWT_REFRESH_SECRET = 'r';
    process.env.SERVICE_API_KEY = 'super-secret-service-key';
  });

  it('laisse passer les routes non service', () => {
    const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
    const guard = new ServiceAuthGuard(reflector);
    expect(guard.canActivate(ctxWithHeader())).toBe(true);
  });

  it('autorise avec la bonne cle de service', () => {
    const reflector = { getAllAndOverride: () => true } as unknown as Reflector;
    const guard = new ServiceAuthGuard(reflector);
    expect(guard.canActivate(ctxWithHeader('super-secret-service-key'))).toBe(true);
  });

  it('refuse avec une cle absente ou erronee', () => {
    const reflector = { getAllAndOverride: () => true } as unknown as Reflector;
    const guard = new ServiceAuthGuard(reflector);
    expect(() => guard.canActivate(ctxWithHeader())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctxWithHeader('mauvaise-cle'))).toThrow(
      UnauthorizedException,
    );
  });
});
