import { Controller, Get, Query } from '@nestjs/common';
import { Permission } from '@alpha/domain';
import type { AuthenticatedUser } from '@alpha/domain';
import { SupervisionService } from './supervision.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/** Supervision de l'agent (responsable / admin). */
@Controller('supervision')
export class SupervisionController {
  constructor(private readonly supervision: SupervisionService) {}

  /** Métriques agrégées : résolution, transfert, latence, motifs, urgences. */
  @RequirePermissions(Permission.SUPERVISION_READ)
  @Get('metrics')
  metrics(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.supervision.metrics(user.id, from, to);
  }
}
