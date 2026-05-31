import { Controller, Post } from '@nestjs/common';
import { Permission } from '@alpha/domain';
import type { AuthenticatedUser } from '@alpha/domain';
import { RetentionService } from './retention.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/** Routes de conformité (admin). */
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly retention: RetentionService) {}

  /** Déclenche une purge par rétention (manuel ; job BullMQ en production). */
  @RequirePermissions(Permission.USERS_MANAGE)
  @Post('retention/purge')
  purge(@CurrentUser() user: AuthenticatedUser) {
    return this.retention.purge(new Date(), user.id);
  }
}
