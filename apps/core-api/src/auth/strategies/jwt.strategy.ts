import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AccessTokenPayload, AuthenticatedUser } from '@alpha/domain';
import { loadConfig } from '../../config/configuration';
import { UsersService } from '../../users/users.service';

/**
 * Strategie JWT : valide le token d'acces et reconstruit l'utilisateur courant.
 * On revalide l'existence/activation du compte a chaque requete (revocation soft).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: loadConfig().jwt.accessSecret,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Compte introuvable ou desactive');
    }
    return this.users.toAuthenticatedUser(user);
  }
}
