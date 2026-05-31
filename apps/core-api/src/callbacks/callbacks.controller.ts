import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CallbackStatus, Permission } from '@alpha/domain';
import type { AuthenticatedUser } from '@alpha/domain';
import { CallbacksService } from './callbacks.service';
import { UpdateCallbackDto } from './dto/update-callback.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('callbacks')
export class CallbacksController {
  constructor(private readonly callbacks: CallbacksService) {}

  /** File de rappel (filtrable par statut). */
  @RequirePermissions(Permission.CALLBACKS_READ)
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: CallbackStatus,
  ) {
    return this.callbacks.list(user.id, status);
  }

  @RequirePermissions(Permission.CALLBACKS_READ)
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.callbacks.getById(id, user.id);
  }

  @RequirePermissions(Permission.CALLBACKS_WRITE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCallbackDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.callbacks.update(id, dto, user.id);
  }

  @RequirePermissions(Permission.CALLBACKS_WRITE)
  @Post(':id/assign-me')
  assignMe(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.callbacks.assignToMe(id, user.id);
  }

  /** Rappeler le patient (click-to-call). */
  @RequirePermissions(Permission.CALLBACKS_WRITE)
  @Post(':id/click-to-call')
  clickToCall(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    // L'extension réelle de la secrétaire sera mappée via 3CX en Phase 2.
    return this.callbacks.clickToCall(id, user.id, `user:${user.id}`);
  }
}
