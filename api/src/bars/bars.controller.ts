import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { BarsService } from './bars.service';
import { CreateBarDto } from './dto/create-bar.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { RespondJoinRequestDto } from './dto/respond-join-request.dto';
import { UpdateBarVisibilityDto } from './dto/update-bar-visibility.dto';

@Controller('bars')
export class BarsController {
  constructor(private readonly barsService: BarsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: Request, @Body() dto: CreateBarDto) {
    const user = req.user as JwtPayload;
    return this.barsService.create(dto.name, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  findMine(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.barsService.findMine(user.sub);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('directory')
  findDirectory(@Req() req: Request) {
    const user = req.user as JwtPayload | undefined;
    return this.barsService.findDirectory(user?.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search-users')
  searchUsers(@Query('q') q: string) {
    return this.barsService.searchUsers(q ?? '');
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('invite/:token/preview')
  previewInviteLink(@Param('token') token: string) {
    return this.barsService.previewInviteLink(token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('invite/:token/join')
  joinViaInviteLink(@Req() req: Request, @Param('token') token: string) {
    const user = req.user as JwtPayload;
    return this.barsService.joinViaInviteLink(token, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/members')
  findMembers(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload;
    return this.barsService.findMembers(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/members')
  inviteMember(@Req() req: Request, @Param('id') id: string, @Body() dto: InviteMemberDto) {
    const user = req.user as JwtPayload;
    return this.barsService.inviteMember(id, user.sub, dto.username, dto.vip ?? false);
  }

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
  @Delete(':id/members/:membershipId')
  removeMember(@Req() req: Request, @Param('id') id: string, @Param('membershipId') membershipId: string) {
    const user = req.user as JwtPayload;
    return this.barsService.removeMember(id, user.sub, membershipId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/visibility')
  setPublic(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateBarVisibilityDto) {
    const user = req.user as JwtPayload;
    return this.barsService.setPublic(id, user.sub, dto.isPublic);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/invite-link')
  generateInviteLink(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload;
    return this.barsService.generateInviteLink(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/join-requests')
  createJoinRequest(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload;
    return this.barsService.createJoinRequest(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/join-requests')
  findPendingRequests(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload;
    return this.barsService.findPendingRequests(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/join-requests/:requestId')
  respondToJoinRequest(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body() dto: RespondJoinRequestDto,
  ) {
    const user = req.user as JwtPayload;
    return this.barsService.respondToJoinRequest(id, user.sub, requestId, dto.accept);
  }
}
