import { Global, Module } from '@nestjs/common';
import { DiscordService } from './discord.service';
import { DiscordBoardService } from './board.service';
import { DiscordNotifyService } from './notify.service';
import { DiscordController } from './discord.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { BarsModule } from '../bars/bars.module';

// Global so the wishlist can refresh the board without importing the module.
@Global()
@Module({
  imports: [PrismaModule, EventsModule, BarsModule],
  providers: [DiscordService, DiscordBoardService, DiscordNotifyService],
  controllers: [DiscordController],
  exports: [DiscordService, DiscordBoardService, DiscordNotifyService],
})
export class DiscordModule {}
