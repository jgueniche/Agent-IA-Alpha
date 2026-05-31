import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '@alpha/domain';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

/** Routes d'authentification. */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Connexion secretaire/admin (email + mot de passe + MFA si activee). */
  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, this.clientIp(req));
  }

  /** Rafraichissement des jetons. */
  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto) {
    const tokens = await this.auth.refresh(dto.refreshToken);
    return { tokens };
  }

  /** Profil de l'utilisateur courant (role + permissions). */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  /** Extrait l'IP client (en tenant compte d'un eventuel reverse-proxy). */
  private clientIp(req: Request): string | undefined {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length > 0) {
      return fwd.split(',')[0]?.trim();
    }
    return req.ip;
  }
}
