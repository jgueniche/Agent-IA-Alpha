import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { loadConfig } from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './crypto/crypto.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';

/**
 * Module racine. Branche la configuration, les modules transverses (Prisma,
 * crypto, audit) et applique globalement les gardes JWT + RBAC.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    PrismaModule,
    CryptoModule,
    AuditModule,
    UsersModule,
    AuthModule,
    HealthModule,
  ],
  providers: [
    // Ordre important : authentification (JWT) puis autorisation (RBAC).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
