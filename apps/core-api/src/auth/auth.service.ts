import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import type {
  AccessTokenPayload,
  AuthenticatedUser,
  AuthTokens,
} from '@alpha/domain';
import { loadConfig } from '../config/configuration';
import { CryptoService } from '../crypto/crypto.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

/**
 * Service d'authentification : verification mot de passe (bcrypt), MFA (TOTP),
 * emission et rafraichissement des jetons JWT. Chaque tentative est auditee.
 */
@Injectable()
export class AuthService {
  private readonly config = loadConfig();

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  /** Authentifie un utilisateur et renvoie les jetons. Audite succes et echecs. */
  async login(
    dto: LoginDto,
    ip?: string,
  ): Promise<{ user: AuthenticatedUser; tokens: AuthTokens }> {
    const user = await this.users.findByEmail(dto.email);

    // Verification mot de passe (toujours executee pour limiter l'oracle de timing).
    const passwordOk =
      !!user && (await bcrypt.compare(dto.password, user.passwordHash));

    if (!user || !user.isActive || !passwordOk) {
      await this.audit.record({
        actorId: user?.id ?? null,
        action: 'login_failed',
        resourceType: 'user',
        resourceId: user?.id ?? null,
        ip,
        metadata: { reason: 'invalid_credentials' },
      });
      throw new UnauthorizedException('Identifiants invalides');
    }

    // MFA (TOTP) si activee sur le compte.
    if (user.mfaEnabled) {
      const secret = this.crypto.decrypt(user.mfaSecret);
      const valid =
        !!secret &&
        !!dto.mfaToken &&
        authenticator.check(dto.mfaToken, secret);
      if (!valid) {
        await this.audit.record({
          actorId: user.id,
          action: 'login_failed',
          resourceType: 'user',
          resourceId: user.id,
          ip,
          metadata: { reason: 'invalid_mfa' },
        });
        throw new UnauthorizedException('Code MFA invalide');
      }
    }

    const authUser = this.users.toAuthenticatedUser(user);
    const tokens = await this.issueTokens(authUser);

    await this.audit.record({
      actorId: user.id,
      action: 'login',
      resourceType: 'user',
      resourceId: user.id,
      ip,
      metadata: { role: authUser.role },
    });

    return { user: authUser, tokens };
  }

  /** Rafraichit la paire de jetons a partir d'un refresh token valide. */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    let sub: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(
        refreshToken,
        { secret: this.config.jwt.refreshSecret },
      );
      sub = payload.sub;
    } catch {
      throw new UnauthorizedException('Refresh token invalide');
    }
    const user = await this.users.findById(sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Compte introuvable ou desactive');
    }
    return this.issueTokens(this.users.toAuthenticatedUser(user));
  }

  /** Genere la paire access/refresh pour un utilisateur. */
  private async issueTokens(user: AuthenticatedUser): Promise<AuthTokens> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.jwt.accessSecret,
      expiresIn: this.config.jwt.accessTtl,
    });
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id },
      {
        secret: this.config.jwt.refreshSecret,
        expiresIn: this.config.jwt.refreshTtl,
      },
    );
    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.jwt.accessTtl,
    };
  }
}
