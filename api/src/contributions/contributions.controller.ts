import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { ContributionsService } from './contributions.service';
import { CreateContributionDto } from './dto/create-contribution.dto';

@UseGuards(JwtAuthGuard)
@Controller('events/:slug/contributions')
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Get()
  findAll(@Param('slug') slug: string) {
    return this.contributionsService.findForEvent(slug);
  }

  @Post()
  create(@Param('slug') slug: string, @Body() dto: CreateContributionDto, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.contributionsService.create(slug, user.sub, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.contributionsService.remove(id, user.sub);
  }
}
