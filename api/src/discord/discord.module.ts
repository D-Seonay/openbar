import { Global, Module } from '@nestjs/common';
import { DiscordService } from './discord.service';
import { DiscordBoardService } from './board.service';
import { DiscordController } from './discord.controller';
import { PrismaModule } from '../prisma/prisma.module';

// Global so the wishlist can refresh the board without importing the module.
@Global()
@Module({
  imports: [PrismaModule],
  providers: [DiscordService, DiscordBoardService],
  controllers: [DiscordController],
  exports: [DiscordService, DiscordBoardService],
})
export class DiscordModule {}
