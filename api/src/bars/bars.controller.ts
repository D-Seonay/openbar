import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { BarsService } from './bars.service';
import { CreateBarDto } from './dto/create-bar.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@UseGuards(JwtAuthGuard)
@Controller('bars')
export class BarsController {
  constructor(private readonly barsService: BarsService) {}

  @Post()
  create(@Req() req: Request, @Body() dto: CreateBarDto) {
    const user = req.user as JwtPayload;
    return this.barsService.create(dto.name, user.sub);
  }

  @Get('mine')
  findMine(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.barsService.findMine(user.sub);
  }

  @Get(':id/members')
  findMembers(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload;
    return this.barsService.findMembers(id, user.sub);
  }

  @Post(':id/members')
  inviteMember(@Req() req: Request, @Param('id') id: string, @Body() dto: InviteMemberDto) {
    const user = req.user as JwtPayload;
    return this.barsService.inviteMember(id, user.sub, dto.username, dto.vip ?? false);
  }

  @Patch(':id/members/:membershipId')
  updateMember(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    const user = req.user as JwtPayload;
    return this.barsService.updateMemberVip(id, user.sub, membershipId, dto.vip);
  }

  @Delete(':id/members/:membershipId')
  removeMember(@Req() req: Request, @Param('id') id: string, @Param('membershipId') membershipId: string) {
    const user = req.user as JwtPayload;
    return this.barsService.removeMember(id, user.sub, membershipId);
  }
}
