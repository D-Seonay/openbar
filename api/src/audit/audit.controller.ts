import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { BarAccessService } from '../bars/bar-access.service';
import { AuditService } from './audit.service';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@UseGuards(JwtAuthGuard)
@Controller('bars/:barId/audit')
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly barAccessService: BarAccessService,
  ) {}

  /**
   * The journal of a bar. Owner or admin only: it names who did what, which is
   * management information rather than something every guest should read.
   */
  @Get()
  async findForBar(
    @Req() req: Request,
    @Param('barId') barId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const user = req.user as JwtPayload;
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(
      barId,
      user,
    );
    if (!isOwnerOrAdmin) {
      return { entries: [], total: 0, page: 1, pageSize: 0 };
    }

    const size = clamp(Number(pageSize), 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
    const current = clamp(Number(page), 1, Number.MAX_SAFE_INTEGER, 1);
    const { entries, total } = await this.auditService.findForBar(
      barId,
      size,
      (current - 1) * size,
    );
    return { entries, total, page: current, pageSize: size };
  }
}

/** Query parameters are user input, so they are bounded rather than trusted. */
function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), min), max);
}
