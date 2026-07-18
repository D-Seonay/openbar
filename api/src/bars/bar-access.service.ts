import { ForbiddenException, Injectable } from '@nestjs/common';
import { BarsService } from './bars.service';
import type { JwtPayload } from '../auth/auth.service';

export interface BarAccess {
  canSeeVip: boolean;
  isOwnerOrAdmin: boolean;
}

@Injectable()
export class BarAccessService {
  constructor(private readonly barsService: BarsService) {}

  async assertMember(barId: string, user: JwtPayload): Promise<BarAccess> {
    if (user.role === 'ADMIN') {
      return { canSeeVip: true, isOwnerOrAdmin: true };
    }

    const membership = await this.barsService.getMembership(barId, user.sub);
    if (!membership) {
      throw new ForbiddenException("Vous n'avez pas accès à ce bar");
    }

    return { canSeeVip: membership.vip, isOwnerOrAdmin: membership.role === 'OWNER' };
  }
}
