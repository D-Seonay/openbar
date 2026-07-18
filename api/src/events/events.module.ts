import { Module } from '@nestjs/common';
import { BarsModule } from '../bars/bars.module';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';

@Module({
  imports: [BarsModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
