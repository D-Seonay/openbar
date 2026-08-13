import { Body, Controller, Delete, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { DiscordService } from './discord.service';
import { LinkDiscordDto } from './dto/link-discord.dto';

@UseGuards(JwtAuthGuard)
@Controller('auth/discord')
export class DiscordController {
  constructor(private readonly discordService: DiscordService) {}

  @Post('link')
  async link(@Req() req: Request, @Body() dto: LinkDiscordDto) {
    const user = req.user as JwtPayload;
    return this.discordService.link(user.sub, dto.code);
  }

  @Delete('link')
  async unlink(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.discordService.unlink(user.sub);
  }
}
