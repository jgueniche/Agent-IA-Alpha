import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** Module global exposant le service d'audit append-only. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
