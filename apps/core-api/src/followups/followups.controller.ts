import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Permission } from '@alpha/domain';
import type { AuthenticatedUser } from '@alpha/domain';
import { FollowupsService } from './followups.service';
import { ScheduleFollowupDto } from './dto/schedule-followup.dto';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ServiceOnly } from '../service-auth/service-only.decorator';

@Controller('followups')
export class FollowupsController {
  constructor(private readonly followups: FollowupsService) {}

  // --- Agent (clé de service) : programmer une relance (send_followup) ------
  @Public()
  @ServiceOnly()
  @Post('schedule')
  scheduleByAgent(@Body() dto: ScheduleFollowupDto) {
    return this.followups.schedule(dto);
  }

  // --- Back-office (JWT + RBAC) --------------------------------------------
  @RequirePermissions(Permission.FOLLOWUPS_READ)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: string) {
    return this.followups.list(user.id, status);
  }

  @RequirePermissions(Permission.FOLLOWUPS_WRITE)
  @Post()
  create(@Body() dto: ScheduleFollowupDto, @CurrentUser() user: AuthenticatedUser) {
    return this.followups.schedule(dto, user.id);
  }

  @RequirePermissions(Permission.FOLLOWUPS_WRITE)
  @Delete(':id')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.followups.cancel(id, user.id);
  }

  @RequirePermissions(Permission.FOLLOWUPS_WRITE)
  @Post(':id/opt-out')
  optOut(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.followups.optOut(id, user.id);
  }

  /** Déclenche le traitement des relances dues (job BullMQ en prod). */
  @RequirePermissions(Permission.FOLLOWUPS_WRITE)
  @Post('dispatch')
  dispatch(@CurrentUser() user: AuthenticatedUser) {
    return this.followups.dispatchDue(new Date(), user.id);
  }
}
