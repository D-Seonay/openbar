import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { BarsModule } from '../bars/bars.module';
import { EventMediaService } from './event-media.service';
import { EventMediaController } from './event-media.controller';

@Module({
  imports: [EventsModule, BarsModule],
  controllers: [EventMediaController],
  providers: [EventMediaService],
})
export class EventMediaModule {}
