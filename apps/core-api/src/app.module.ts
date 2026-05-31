import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { loadConfig } from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './crypto/crypto.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';
import { CallsModule } from './calls/calls.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { CalendarModule } from './calendar/calendar.module';
import { CallbacksModule } from './callbacks/callbacks.module';
import { PatientsModule } from './patients/patients.module';
import { FollowupsModule } from './followups/followups.module';
import { ComplianceModule } from './compliance/compliance.module';
import { SupervisionModule } from './supervision/supervision.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { ServiceAuthGuard } from './service-auth/service-auth.guard';

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
    // Durcissement : limitation de débit (anti-abus / brute force).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    CryptoModule,
    AuditModule,
    UsersModule,
    AuthModule,
    HealthModule,
    CallsModule,
    KnowledgeModule,
    CalendarModule,
    CallbacksModule,
    PatientsModule,
    FollowupsModule,
    ComplianceModule,
    SupervisionModule,
  ],
  providers: [
    // Ordre : limitation de débit, puis auth utilisateur (JWT, ignore @Public),
    // puis clé de service (@ServiceOnly), puis autorisation RBAC.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ServiceAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
