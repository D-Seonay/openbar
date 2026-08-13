import { Module } from '@nestjs/common';
import { DiscordService } from './discord.service';
import { DiscordController } from './discord.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [DiscordService],
  controllers: [DiscordController],
  exports: [DiscordService],
})
export class DiscordModule {}
