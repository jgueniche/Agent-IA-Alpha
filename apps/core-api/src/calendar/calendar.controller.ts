import { Body, Controller, Post } from '@nestjs/common';
import { Permission } from '@alpha/domain';
import type { AuthenticatedUser } from '@alpha/domain';
import { CalendarService } from './calendar.service';
import { AvailabilitiesDto } from './dto/availabilities.dto';
import { BookingRequestDto } from './dto/booking-request.dto';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ServiceOnly } from '../service-auth/service-only.decorator';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  // --- Agent (clé de service) ----------------------------------------------

  /** Disponibilités lues depuis la sync (outil get_availabilities). */
  @Public()
  @ServiceOnly()
  @Post('availabilities')
  availabilities(@Body() dto: AvailabilitiesDto) {
    return this.calendar.getAvailabilities(dto);
  }

  /** Déport d'une prise de RDV vers une tâche de rappel (create_callback_task). */
  @Public()
  @ServiceOnly()
  @Post('booking-request')
  booking(@Body() dto: BookingRequestDto) {
    return this.calendar.deferBooking(dto);
  }

  // --- Back-office ----------------------------------------------------------

  /** Déclenche une synchronisation des flux agenda (manager/admin). */
  @RequirePermissions(Permission.SUPERVISION_READ)
  @Post('sync')
  sync(@CurrentUser() user: AuthenticatedUser) {
    return this.calendar.sync(user.id);
  }
}
