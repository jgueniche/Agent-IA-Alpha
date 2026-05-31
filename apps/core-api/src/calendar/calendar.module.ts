import { Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';

/** Module agenda : abstraction CalendarProvider (iCal / Doctolib), sync, déport RDV. */
@Module({
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
