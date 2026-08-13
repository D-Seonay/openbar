import { Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { BarsModule } from '../bars/bars.module';

@Module({
  imports: [PrismaModule, EventsModule, BarsModule],
  providers: [CalendarService],
  controllers: [CalendarController],
})
export class CalendarModule {}
