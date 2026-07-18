import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { BarsModule } from '../bars/bars.module';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { StockAdjustmentsController } from './stock-adjustments.controller';

@Module({
  imports: [EventsModule, BarsModule],
  controllers: [StockAdjustmentsController],
  providers: [StockAdjustmentsService],
})
export class StockAdjustmentsModule {}
