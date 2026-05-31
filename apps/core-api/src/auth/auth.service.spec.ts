import { UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { RoleName } from '@alpha/domain';
import { AuthService } from './auth.service';
import { CryptoService } from '../crypto/crypto.service';
import type { UsersService } from '../users/users.service';
import type { AuditService } from '../audit/audit.service';

describe('AuthService', () => {
  let service: AuthService;
  let auditRecords: any[];
  let usersMock: UsersService;
  let auditMock: AuditService;

  const passwordHash = bcrypt.hashSync('GoodPass1!', 10);

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
    process.env.DATABASE_URL = 'postgresql://test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  });

  beforeEach(() => {
    auditRecords = [];
    const dbUser = {
      id: 'u1',
      email: 'sec@alpha.local',
      displayName: 'Sec',
      passwordHash,
      isActive: true,
      mfaEnabled: false,
      mfaSecret: null,
      role: {
        name: RoleName.SECRETARY,
        permissions: [{ code: 'calls:read' }],
      },
    };
    usersMock = {
      findByEmail: jest.fn(async (email: string) =>
        email === dbUser.email ? dbUser : null,
      ),
      findById: jest.fn(async (id: string) => (id === 'u1' ? dbUser : null)),
      toAuthenticatedUser: (u: any) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.role.name,
        permissions: u.role.permissions.map((p: any) => p.code),
      }),
    } as unknown as UsersService;
    auditMock = {
      record: jest.fn(async (e: any) => {
        auditRecords.push(e);
      }),
    } as unknown as AuditService;

    // JwtService minimal : signe/verifie de maniere deterministe pour le test.
    const jwtMock: any = {
      signAsync: jest.fn(async (payload: any) => `tok:${JSON.stringify(payload)}`),
      verifyAsync: jest.fn(async (token: string) => JSON.parse(token.slice(4))),
    };

    service = new AuthService(
      usersMock,
      jwtMock,
      new CryptoService(),
      auditMock,
    );
  });

  it('connecte un utilisateur valide et audite le succes', async () => {
    const { user, tokens } = await service.login(
      { email: 'sec@alpha.local', password: 'GoodPass1!' },
      '10.0.0.5',
    );
    expect(user.role).toBe(RoleName.SECRETARY);
    expect(tokens.accessToken).toContain('tok:');
    expect(auditRecords.at(-1)).toMatchObject({ action: 'login', actorId: 'u1' });
  });

  it('rejette un mauvais mot de passe et audite l echec', async () => {
    await expect(
      service.login({ email: 'sec@alpha.local', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auditRecords.at(-1)).toMatchObject({
      action: 'login_failed',
      metadata: { reason: 'invalid_credentials' },
    });
  });

  it('rejette un email inconnu sans reveler l existence du compte', async () => {
    await expect(
      service.login({ email: 'inconnu@alpha.local', password: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
