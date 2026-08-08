import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { BarAccessService } from './bar-access.service';
import { BarsService } from './bars.service';
import type { JwtPayload } from '../auth/auth.service';

describe('BarAccessService', () => {
  let service: BarAccessService;
  let barsService: { getMembership: jest.Mock };

  const BAR_ID = 'bar-1';
  const admin: JwtPayload = {
    sub: 'admin-1',
    username: 'root',
    role: 'ADMIN',
    vip: false,
    mustChangePassword: false,
  };
  const member: JwtPayload = {
    sub: 'user-1',
    username: 'alice',
    role: 'USER',
    vip: false,
    mustChangePassword: false,
  };

  beforeEach(async () => {
    barsService = { getMembership: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BarAccessService,
        { provide: BarsService, useValue: barsService },
      ],
    }).compile();

    service = moduleRef.get(BarAccessService);
  });

  it('grants full access to an ADMIN without a membership lookup', async () => {
    const access = await service.assertMember(BAR_ID, admin);

    expect(access).toEqual({ canSeeVip: true, isOwnerOrAdmin: true });
    expect(barsService.getMembership).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException for a non-member', async () => {
    barsService.getMembership.mockResolvedValue(null);

    await expect(service.assertMember(BAR_ID, member)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('grants VIP visibility and owner status for an OWNER member', async () => {
    barsService.getMembership.mockResolvedValue({ role: 'OWNER', vip: true });

    const access = await service.assertMember(BAR_ID, member);

    expect(access).toEqual({ canSeeVip: true, isOwnerOrAdmin: true });
  });

  it('denies VIP visibility and owner status for a non-VIP MEMBER', async () => {
    barsService.getMembership.mockResolvedValue({ role: 'MEMBER', vip: false });

    const access = await service.assertMember(BAR_ID, member);

    expect(access).toEqual({ canSeeVip: false, isOwnerOrAdmin: false });
  });

  it('grants VIP visibility but not owner status for a VIP MEMBER', async () => {
    barsService.getMembership.mockResolvedValue({ role: 'MEMBER', vip: true });

    const access = await service.assertMember(BAR_ID, member);

    expect(access).toEqual({ canSeeVip: true, isOwnerOrAdmin: false });
  });
});
