import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { BarAccessService } from '../bars/bar-access.service';
import { BottlesService } from './bottles.service';
import { CreateBottleDto } from './dto/create-bottle.dto';
import { UpdateBottleDto } from './dto/update-bottle.dto';

@UseGuards(JwtAuthGuard)
@Controller('bottles')
export class BottlesController {
  constructor(
    private readonly bottlesService: BottlesService,
    private readonly barAccessService: BarAccessService,
  ) {}

  @Get()
  async findAll(@Req() req: Request, @Query('barId') barId: string) {
    const user = req.user as JwtPayload;
    const { canSeeVip } = await this.barAccessService.assertMember(barId, user);
    return this.bottlesService.findAll(barId, canSeeVip);
  }

  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload;
    const bottle = await this.bottlesService.findOne(id);
    await this.barAccessService.assertMember(bottle.barId, user);
    return bottle;
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateBottleDto) {
    const user = req.user as JwtPayload;
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(dto.barId, user);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Seul le propriétaire du bar peut gérer le stock');
    }
    return this.bottlesService.create(dto);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateBottleDto) {
    const user = req.user as JwtPayload;
    const bottle = await this.bottlesService.findOne(id);
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(bottle.barId, user);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Seul le propriétaire du bar peut gérer le stock');
    }
    return this.bottlesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload;
    const bottle = await this.bottlesService.findOne(id);
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(bottle.barId, user);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Seul le propriétaire du bar peut gérer le stock');
    }
    return this.bottlesService.remove(id);
  }
}
