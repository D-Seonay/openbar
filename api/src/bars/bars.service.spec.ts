import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BarsService } from './bars.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

describe('BarsService', () => {
  let service: BarsService;
  let prisma: {
    bar: Record<string, jest.Mock>;
    barMembership: Record<string, jest.Mock>;
  };
  let usersService: { findByUsername: jest.Mock };

  const OWNER_ID = 'owner-1';
  const OTHER_ID = 'other-1';
  const BAR_ID = 'bar-1';

  beforeEach(async () => {
    prisma = {
      bar: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      barMembership: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    usersService = { findByUsername: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BarsService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = moduleRef.get(BarsService);
  });

  describe('create', () => {
    it('creates a bar with an OWNER membership for the creator', async () => {
      prisma.barMembership.findFirst.mockResolvedValue(null);
      prisma.bar.create.mockResolvedValue({ id: BAR_ID, name: 'Chez Noa', memberships: [] });

      await service.create('Chez Noa', OWNER_ID);

      expect(prisma.barMembership.findFirst).toHaveBeenCalledWith({
        where: { userId: OWNER_ID, role: 'OWNER' },
      });
      expect(prisma.bar.create).toHaveBeenCalledWith({
        data: {
          name: 'Chez Noa',
          memberships: { create: { userId: OWNER_ID, role: 'OWNER', vip: true } },
        },
        include: { memberships: true },
      });
    });

    it('rejects if the user already owns a bar', async () => {
      prisma.barMembership.findFirst.mockResolvedValue({ id: 'm1', role: 'OWNER' });

      await expect(service.create('Second bar', OWNER_ID)).rejects.toThrow(ConflictException);
      expect(prisma.bar.create).not.toHaveBeenCalled();
    });
  });

  describe('findMine', () => {
    it('flattens each bar to include the caller role and vip', async () => {
      prisma.bar.findMany.mockResolvedValue([
        {
          id: BAR_ID,
          name: 'Chez Noa',
          createdAt: new Date('2026-01-01'),
          memberships: [{ role: 'OWNER', vip: true }],
        },
      ]);

      const result = await service.findMine(OWNER_ID);

      expect(prisma.bar.findMany).toHaveBeenCalledWith({
        where: { memberships: { some: { userId: OWNER_ID } } },
        include: { memberships: { where: { userId: OWNER_ID } } },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([
        { id: BAR_ID, name: 'Chez Noa', createdAt: new Date('2026-01-01'), myRole: 'OWNER', myVip: true },
      ]);
    });
  });

  describe('findMembers', () => {
    it('throws NotFoundException if the bar does not exist', async () => {
      prisma.bar.findUnique.mockResolvedValue(null);

      await expect(service.findMembers(BAR_ID, OWNER_ID)).rejects.toThrow(NotFoundException);
    });

    it('forbids a non-member from viewing the roster', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue(null);

      await expect(service.findMembers(BAR_ID, OTHER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('returns the roster for a member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'OWNER' });
      prisma.barMembership.findMany.mockResolvedValue([{ id: 'm1', role: 'OWNER', user: { username: 'noa' } }]);

      const result = await service.findMembers(BAR_ID, OWNER_ID);

      expect(result).toEqual([{ id: 'm1', role: 'OWNER', user: { username: 'noa' } }]);
    });
  });

  describe('inviteMember', () => {
    it('forbids a non-owner from inviting', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'MEMBER' });

      await expect(service.inviteMember(BAR_ID, OTHER_ID, 'bob', false)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for an unknown username', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'OWNER' });
      usersService.findByUsername.mockResolvedValue(null);

      await expect(service.inviteMember(BAR_ID, OWNER_ID, 'ghost', false)).rejects.toThrow(NotFoundException);
    });

    it('rejects if the target is already a member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm1', role: 'OWNER' })
        .mockResolvedValueOnce({ id: 'm2', role: 'MEMBER' });
      usersService.findByUsername.mockResolvedValue({ id: OTHER_ID, username: 'bob' });

      await expect(service.inviteMember(BAR_ID, OWNER_ID, 'bob', false)).rejects.toThrow(ConflictException);
    });

    it('creates a MEMBER membership for the target user', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm1', role: 'OWNER' })
        .mockResolvedValueOnce(null);
      usersService.findByUsername.mockResolvedValue({ id: OTHER_ID, username: 'bob' });
      prisma.barMembership.create.mockResolvedValue({ id: 'm2', role: 'MEMBER', vip: true, user: { username: 'bob' } });

      const result = await service.inviteMember(BAR_ID, OWNER_ID, 'bob', true);

      expect(prisma.barMembership.create).toHaveBeenCalledWith({
        data: { barId: BAR_ID, userId: OTHER_ID, role: 'MEMBER', vip: true },
        include: { user: { select: { username: true } } },
      });
      expect(result).toEqual({ id: 'm2', role: 'MEMBER', vip: true, user: { username: 'bob' } });
    });
  });

  describe('updateMemberVip', () => {
    it('forbids a non-owner from updating VIP status', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'MEMBER' });

      await expect(service.updateMemberVip(BAR_ID, OTHER_ID, 'm2', true)).rejects.toThrow(ForbiddenException);
    });

    it('refuses to change the OWNER membership', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm1', role: 'OWNER' })
        .mockResolvedValueOnce({ id: 'm1', barId: BAR_ID, role: 'OWNER' });

      await expect(service.updateMemberVip(BAR_ID, OWNER_ID, 'm1', false)).rejects.toThrow(ForbiddenException);
    });

    it('updates the vip flag for a member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm1', role: 'OWNER' })
        .mockResolvedValueOnce({ id: 'm2', barId: BAR_ID, role: 'MEMBER' });
      prisma.barMembership.update.mockResolvedValue({ id: 'm2', role: 'MEMBER', vip: true, user: { username: 'bob' } });

      const result = await service.updateMemberVip(BAR_ID, OWNER_ID, 'm2', true);

      expect(prisma.barMembership.update).toHaveBeenCalledWith({
        where: { id: 'm2' },
        data: { vip: true },
        include: { user: { select: { username: true } } },
      });
      expect(result.vip).toBe(true);
    });
  });

  describe('removeMember', () => {
    it('refuses to remove the OWNER membership', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValueOnce({ id: 'm1', barId: BAR_ID, role: 'OWNER', userId: OWNER_ID });

      await expect(service.removeMember(BAR_ID, OWNER_ID, 'm1')).rejects.toThrow(ForbiddenException);
    });

    it('allows the owner to remove another member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm2', barId: BAR_ID, role: 'MEMBER', userId: OTHER_ID })
        .mockResolvedValueOnce({ id: 'm1', role: 'OWNER', userId: OWNER_ID });
      prisma.barMembership.delete.mockResolvedValue({ id: 'm2' });

      const result = await service.removeMember(BAR_ID, OWNER_ID, 'm2');

      expect(result).toEqual({ success: true });
      expect(prisma.barMembership.delete).toHaveBeenCalledWith({ where: { id: 'm2' } });
    });

    it('allows a member to remove themselves', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm2', barId: BAR_ID, role: 'MEMBER', userId: OTHER_ID })
        .mockResolvedValueOnce({ id: 'm2', role: 'MEMBER', userId: OTHER_ID });
      prisma.barMembership.delete.mockResolvedValue({ id: 'm2' });

      const result = await service.removeMember(BAR_ID, OTHER_ID, 'm2');

      expect(result).toEqual({ success: true });
    });

    it('forbids a non-owner from removing someone else', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm3', barId: BAR_ID, role: 'MEMBER', userId: 'third-user' })
        .mockResolvedValueOnce({ id: 'm2', role: 'MEMBER', userId: OTHER_ID });

      await expect(service.removeMember(BAR_ID, OTHER_ID, 'm3')).rejects.toThrow(ForbiddenException);
      expect(prisma.barMembership.delete).not.toHaveBeenCalled();
    });
  });
});
