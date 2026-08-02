import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { BarsModule } from '../bars/bars.module';
import { WishlistService } from './wishlist.service';
import { WishlistController } from './wishlist.controller';

@Module({
  imports: [EventsModule, BarsModule],
  controllers: [WishlistController],
  providers: [WishlistService],
})
export class WishlistModule {}
