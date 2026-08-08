import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { BarsService } from './bars.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

jest.mock('crypto', () => ({ randomBytes: jest.fn() }));

describe('BarsService', () => {
  let service: BarsService;
  let prisma: {
    bar: Record<string, jest.Mock>;
    barMembership: Record<string, jest.Mock>;
  };
  let usersService: { findByUsername: jest.Mock; search: jest.Mock };

  const OWNER_ID = 'owner-1';
  const OTHER_ID = 'other-1';
  const BAR_ID = 'bar-1';

  beforeEach(async () => {
    prisma = {
      bar: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      barMembership: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      barJoinRequest: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    usersService = { findByUsername: jest.fn(), search: jest.fn() };

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
      prisma.bar.create.mockResolvedValue({
        id: BAR_ID,
        name: 'Chez Noa',
        memberships: [],
      });

      await service.create('Chez Noa', OWNER_ID);

      expect(prisma.barMembership.findFirst).toHaveBeenCalledWith({
        where: { userId: OWNER_ID, role: 'OWNER' },
      });
      expect(prisma.bar.create).toHaveBeenCalledWith({
        data: {
          name: 'Chez Noa',
          isPublic: false,
          memberships: {
            create: { userId: OWNER_ID, role: 'OWNER', vip: true },
          },
        },
        include: { memberships: true },
      });
    });

    it('rejects if the user already owns a bar', async () => {
      prisma.barMembership.findFirst.mockResolvedValue({
        id: 'm1',
        role: 'OWNER',
      });

      await expect(service.create('Second bar', OWNER_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.bar.create).not.toHaveBeenCalled();
    });
  });

  describe('findMine', () => {
    it('flattens each bar to include the caller role, vip, visibility, and invite token (owner only)', async () => {
      prisma.bar.findMany.mockResolvedValue([
        {
          id: BAR_ID,
          name: 'Chez Noa',
          createdAt: new Date('2026-01-01'),
          isPublic: true,
          inviteToken: 'tok-1',
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
        {
          id: BAR_ID,
          name: 'Chez Noa',
          createdAt: new Date('2026-01-01'),
          myRole: 'OWNER',
          myVip: true,
          isPublic: true,
          inviteToken: 'tok-1',
        },
      ]);
    });

    it('hides the invite token from a non-owner member', async () => {
      prisma.bar.findMany.mockResolvedValue([
        {
          id: BAR_ID,
          name: 'Chez Noa',
          createdAt: new Date('2026-01-01'),
          isPublic: true,
          inviteToken: 'tok-1',
          memberships: [{ role: 'MEMBER', vip: false }],
        },
      ]);

      const result = await service.findMine(OTHER_ID);

      expect(result[0].inviteToken).toBeNull();
    });
  });

  describe('findMembers', () => {
    it('throws NotFoundException if the bar does not exist', async () => {
      prisma.bar.findUnique.mockResolvedValue(null);

      await expect(service.findMembers(BAR_ID, OWNER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('forbids a non-member from viewing the roster', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue(null);

      await expect(service.findMembers(BAR_ID, OTHER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns the roster for a member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'OWNER',
      });
      prisma.barMembership.findMany.mockResolvedValue([
        { id: 'm1', role: 'OWNER', user: { username: 'noa' } },
      ]);

      const result = await service.findMembers(BAR_ID, OWNER_ID);

      expect(result).toEqual([
        { id: 'm1', role: 'OWNER', user: { username: 'noa' } },
      ]);
    });

    it('allows an admin without a real membership to view the roster', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
      prisma.barMembership.findMany.mockResolvedValue([
        { id: 'm1', role: 'OWNER', user: { username: 'noa' } },
      ]);

      const result = await service.findMembers(BAR_ID, 'admin-1');

      expect(result).toEqual([
        { id: 'm1', role: 'OWNER', user: { username: 'noa' } },
      ]);
    });
  });

  describe('inviteMember', () => {
    it('forbids a non-owner from inviting', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'MEMBER',
      });

      await expect(
        service.inviteMember(BAR_ID, OTHER_ID, 'bob', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for an unknown username', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'OWNER',
      });
      usersService.findByUsername.mockResolvedValue(null);

      await expect(
        service.inviteMember(BAR_ID, OWNER_ID, 'ghost', false),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects if the target is already a member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm1', role: 'OWNER' })
        .mockResolvedValueOnce({ id: 'm2', role: 'MEMBER' });
      usersService.findByUsername.mockResolvedValue({
        id: OTHER_ID,
        username: 'bob',
      });

      await expect(
        service.inviteMember(BAR_ID, OWNER_ID, 'bob', false),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a MEMBER membership for the target user', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm1', role: 'OWNER' })
        .mockResolvedValueOnce(null);
      usersService.findByUsername.mockResolvedValue({
        id: OTHER_ID,
        username: 'bob',
      });
      prisma.barMembership.create.mockResolvedValue({
        id: 'm2',
        role: 'MEMBER',
        vip: true,
        user: { username: 'bob' },
      });

      const result = await service.inviteMember(BAR_ID, OWNER_ID, 'bob', true);

      expect(prisma.barMembership.create).toHaveBeenCalledWith({
        data: { barId: BAR_ID, userId: OTHER_ID, role: 'MEMBER', vip: true },
        include: {
          user: {
            select: {
              username: true,
              birthday: true,
              favoriteDrink: true,
              allergies: true,
              avatarUrl: true,
            },
          },
        },
      });
      expect(result).toEqual({
        id: 'm2',
        role: 'MEMBER',
        vip: true,
        user: { username: 'bob' },
      });
    });
  });

  describe('updateMemberVip', () => {
    it('forbids a non-owner from updating VIP status', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'MEMBER',
      });

      await expect(
        service.updateMemberVip(BAR_ID, OTHER_ID, 'm2', true),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuses to change the OWNER membership', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm1', role: 'OWNER' })
        .mockResolvedValueOnce({ id: 'm1', barId: BAR_ID, role: 'OWNER' });

      await expect(
        service.updateMemberVip(BAR_ID, OWNER_ID, 'm1', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates the vip flag for a member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm1', role: 'OWNER' })
        .mockResolvedValueOnce({ id: 'm2', barId: BAR_ID, role: 'MEMBER' });
      prisma.barMembership.update.mockResolvedValue({
        id: 'm2',
        role: 'MEMBER',
        vip: true,
        user: { username: 'bob' },
      });

      const result = await service.updateMemberVip(
        BAR_ID,
        OWNER_ID,
        'm2',
        true,
      );

      expect(prisma.barMembership.update).toHaveBeenCalledWith({
        where: { id: 'm2' },
        data: { vip: true },
        include: {
          user: {
            select: {
              username: true,
              birthday: true,
              favoriteDrink: true,
              allergies: true,
              avatarUrl: true,
            },
          },
        },
      });
      expect(result.vip).toBe(true);
    });
  });

  describe('removeMember', () => {
    it('refuses to remove the OWNER membership', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValueOnce({
        id: 'm1',
        barId: BAR_ID,
        role: 'OWNER',
        userId: OWNER_ID,
      });

      await expect(
        service.removeMember(BAR_ID, OWNER_ID, 'm1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows the owner to remove another member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({
          id: 'm2',
          barId: BAR_ID,
          role: 'MEMBER',
          userId: OTHER_ID,
        })
        .mockResolvedValueOnce({ id: 'm1', role: 'OWNER', userId: OWNER_ID });
      prisma.barMembership.delete.mockResolvedValue({ id: 'm2' });

      const result = await service.removeMember(BAR_ID, OWNER_ID, 'm2');

      expect(result).toEqual({ success: true });
      expect(prisma.barMembership.delete).toHaveBeenCalledWith({
        where: { id: 'm2' },
      });
    });

    it('allows a member to remove themselves', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({
          id: 'm2',
          barId: BAR_ID,
          role: 'MEMBER',
          userId: OTHER_ID,
        })
        .mockResolvedValueOnce({ id: 'm2', role: 'MEMBER', userId: OTHER_ID });
      prisma.barMembership.delete.mockResolvedValue({ id: 'm2' });

      const result = await service.removeMember(BAR_ID, OTHER_ID, 'm2');

      expect(result).toEqual({ success: true });
    });

    it('forbids a non-owner from removing someone else', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({
          id: 'm3',
          barId: BAR_ID,
          role: 'MEMBER',
          userId: 'third-user',
        })
        .mockResolvedValueOnce({ id: 'm2', role: 'MEMBER', userId: OTHER_ID });

      await expect(
        service.removeMember(BAR_ID, OTHER_ID, 'm3'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.barMembership.delete).not.toHaveBeenCalled();
    });

    it('allows an admin without a real membership to remove a member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({
          id: 'm2',
          barId: BAR_ID,
          role: 'MEMBER',
          userId: OTHER_ID,
        })
        .mockResolvedValueOnce(null);
      prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
      prisma.barMembership.delete.mockResolvedValue({ id: 'm2' });

      const result = await service.removeMember(BAR_ID, 'admin-1', 'm2');

      expect(result).toEqual({ success: true });
    });
  });

  describe('setPublic', () => {
    it('forbids a non-owner from changing visibility', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'MEMBER',
      });

      await expect(service.setPublic(BAR_ID, OTHER_ID, true)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('updates the bar visibility for the owner', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'OWNER',
      });
      prisma.bar.update.mockResolvedValue({ id: BAR_ID, isPublic: false });

      const result = await service.setPublic(BAR_ID, OWNER_ID, false);

      expect(prisma.bar.update).toHaveBeenCalledWith({
        where: { id: BAR_ID },
        data: { isPublic: false },
      });
      expect(result).toEqual({ id: BAR_ID, isPublic: false });
    });
  });

  describe('rename', () => {
    it('forbids a non-owner from renaming the bar', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'MEMBER',
      });

      await expect(
        service.rename(BAR_ID, OTHER_ID, 'Nouveau Nom'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates the bar name for the owner', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'OWNER',
      });
      prisma.bar.update.mockResolvedValue({ id: BAR_ID, name: 'Nouveau Nom' });

      const result = await service.rename(BAR_ID, OWNER_ID, 'Nouveau Nom');

      expect(prisma.bar.update).toHaveBeenCalledWith({
        where: { id: BAR_ID },
        data: { name: 'Nouveau Nom' },
      });
      expect(result).toEqual({ id: BAR_ID, name: 'Nouveau Nom' });
    });

    it('allows an admin without a real membership to rename the bar', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
      prisma.bar.update.mockResolvedValue({ id: BAR_ID, name: 'Nouveau Nom' });

      const result = await service.rename(BAR_ID, 'admin-1', 'Nouveau Nom');

      expect(prisma.barMembership.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual({ id: BAR_ID, name: 'Nouveau Nom' });
    });
  });

  describe('findDirectory', () => {
    it('flags OWNER/MEMBER/PENDING/NONE correctly per bar', async () => {
      prisma.bar.findMany.mockResolvedValue([
        {
          id: 'bar-owned',
          name: 'Mon Bar',
          memberships: [
            { userId: OWNER_ID, role: 'OWNER', user: { username: 'owner1' } },
          ],
          _count: { memberships: 1 },
        },
        {
          id: 'bar-member',
          name: 'Bar Ami',
          memberships: [
            {
              userId: 'friend-1',
              role: 'OWNER',
              user: { username: 'friend1' },
            },
            { userId: OWNER_ID, role: 'MEMBER', user: { username: 'owner1' } },
          ],
          _count: { memberships: 2 },
        },
        {
          id: 'bar-pending',
          name: 'Bar Inconnu',
          memberships: [
            {
              userId: 'stranger-1',
              role: 'OWNER',
              user: { username: 'stranger1' },
            },
          ],
          _count: { memberships: 1 },
        },
        {
          id: 'bar-none',
          name: 'Bar Lointain',
          memberships: [
            {
              userId: 'stranger-2',
              role: 'OWNER',
              user: { username: 'stranger2' },
            },
          ],
          _count: { memberships: 1 },
        },
      ]);
      prisma.barJoinRequest.findMany.mockResolvedValue([
        { barId: 'bar-pending' },
      ]);

      const result = await service.findDirectory(OWNER_ID);

      expect(prisma.bar.findMany).toHaveBeenCalledWith({
        where: { isPublic: true },
        include: {
          memberships: {
            select: {
              userId: true,
              role: true,
              user: { select: { username: true } },
            },
          },
          _count: { select: { memberships: true } },
        },
        orderBy: { name: 'asc' },
      });
      expect(prisma.barJoinRequest.findMany).toHaveBeenCalledWith({
        where: { userId: OWNER_ID, status: 'PENDING' },
        select: { barId: true },
      });
      expect(result).toEqual([
        {
          id: 'bar-owned',
          name: 'Mon Bar',
          ownerUsername: 'owner1',
          memberCount: 1,
          myStatus: 'OWNER',
        },
        {
          id: 'bar-member',
          name: 'Bar Ami',
          ownerUsername: 'friend1',
          memberCount: 2,
          myStatus: 'MEMBER',
        },
        {
          id: 'bar-pending',
          name: 'Bar Inconnu',
          ownerUsername: 'stranger1',
          memberCount: 1,
          myStatus: 'PENDING',
        },
        {
          id: 'bar-none',
          name: 'Bar Lointain',
          ownerUsername: 'stranger2',
          memberCount: 1,
          myStatus: 'NONE',
        },
      ]);
    });

    it('returns myStatus NONE for every bar when called without a userId (guest)', async () => {
      prisma.bar.findMany.mockResolvedValue([
        {
          id: 'bar-a',
          name: 'Bar A',
          memberships: [
            { userId: OWNER_ID, role: 'OWNER', user: { username: 'owner1' } },
          ],
          _count: { memberships: 1 },
        },
      ]);

      const result = await service.findDirectory();

      expect(prisma.barJoinRequest.findMany).not.toHaveBeenCalled();
      expect(result).toEqual([
        {
          id: 'bar-a',
          name: 'Bar A',
          ownerUsername: 'owner1',
          memberCount: 1,
          myStatus: 'NONE',
        },
      ]);
    });
  });

  describe('createJoinRequest', () => {
    it('rejects a join request for a private bar', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID, isPublic: false });

      await expect(service.createJoinRequest(BAR_ID, OTHER_ID)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.barMembership.findUnique).not.toHaveBeenCalled();
    });

    it('rejects if the caller is already a member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID, isPublic: true });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'MEMBER',
      });

      await expect(service.createJoinRequest(BAR_ID, OTHER_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.barJoinRequest.create).not.toHaveBeenCalled();
    });

    it('rejects if a PENDING request already exists', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID, isPublic: true });
      prisma.barMembership.findUnique.mockResolvedValue(null);
      prisma.barJoinRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'PENDING',
      });

      await expect(service.createJoinRequest(BAR_ID, OTHER_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.barJoinRequest.create).not.toHaveBeenCalled();
    });

    it('reactivates a DECLINED request instead of creating a new row', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID, isPublic: true });
      prisma.barMembership.findUnique.mockResolvedValue(null);
      prisma.barJoinRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'DECLINED',
      });
      prisma.barJoinRequest.update.mockResolvedValue({
        id: 'req-1',
        status: 'PENDING',
      });

      const result = await service.createJoinRequest(BAR_ID, OTHER_ID);

      expect(prisma.barJoinRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'PENDING' },
      });
      expect(prisma.barJoinRequest.create).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'req-1', status: 'PENDING' });
    });

    it('creates a new PENDING request when none exists', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID, isPublic: true });
      prisma.barMembership.findUnique.mockResolvedValue(null);
      prisma.barJoinRequest.findUnique.mockResolvedValue(null);
      prisma.barJoinRequest.create.mockResolvedValue({
        id: 'req-2',
        status: 'PENDING',
      });

      const result = await service.createJoinRequest(BAR_ID, OTHER_ID);

      expect(prisma.barJoinRequest.create).toHaveBeenCalledWith({
        data: { barId: BAR_ID, userId: OTHER_ID, status: 'PENDING' },
      });
      expect(result).toEqual({ id: 'req-2', status: 'PENDING' });
    });
  });

  describe('findPendingRequests', () => {
    it('forbids a non-owner from listing requests', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'MEMBER',
      });

      await expect(
        service.findPendingRequests(BAR_ID, OTHER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns PENDING requests for the owner', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'OWNER',
      });
      prisma.barJoinRequest.findMany.mockResolvedValue([
        { id: 'req-1', status: 'PENDING', user: { username: 'bob' } },
      ]);

      const result = await service.findPendingRequests(BAR_ID, OWNER_ID);

      expect(prisma.barJoinRequest.findMany).toHaveBeenCalledWith({
        where: { barId: BAR_ID, status: 'PENDING' },
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual([
        { id: 'req-1', status: 'PENDING', user: { username: 'bob' } },
      ]);
    });
  });

  describe('respondToJoinRequest', () => {
    it('forbids a non-owner from responding', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'MEMBER',
      });

      await expect(
        service.respondToJoinRequest(BAR_ID, OTHER_ID, 'req-1', true),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for an unknown request', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'OWNER',
      });
      prisma.barJoinRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.respondToJoinRequest(BAR_ID, OWNER_ID, 'missing', true),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a request that is no longer PENDING', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'OWNER',
      });
      prisma.barJoinRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        barId: BAR_ID,
        userId: OTHER_ID,
        status: 'ACCEPTED',
      });

      await expect(
        service.respondToJoinRequest(BAR_ID, OWNER_ID, 'req-1', true),
      ).rejects.toThrow(ConflictException);
    });

    it('accepting creates a membership and marks the request ACCEPTED', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm1', role: 'OWNER' }) // assertOwner check
        .mockResolvedValueOnce(null); // existing membership check for requester
      prisma.barJoinRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        barId: BAR_ID,
        userId: OTHER_ID,
        status: 'PENDING',
      });
      prisma.$transaction.mockResolvedValue([
        { id: 'm2' },
        { id: 'req-1', status: 'ACCEPTED' },
      ]);

      const result = await service.respondToJoinRequest(
        BAR_ID,
        OWNER_ID,
        'req-1',
        true,
      );

      expect(prisma.barMembership.create).toHaveBeenCalledWith({
        data: { barId: BAR_ID, userId: OTHER_ID, role: 'MEMBER', vip: false },
      });
      expect(prisma.barJoinRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'ACCEPTED' },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual({ id: 'req-1', status: 'ACCEPTED' });
    });

    it('rejects acceptance if the requester already has a membership for this bar', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm1', role: 'OWNER' }) // assertOwner check
        .mockResolvedValueOnce({ id: 'm2', role: 'MEMBER' }); // requester already has a membership
      prisma.barJoinRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        barId: BAR_ID,
        userId: OTHER_ID,
        status: 'PENDING',
      });

      await expect(
        service.respondToJoinRequest(BAR_ID, OWNER_ID, 'req-1', true),
      ).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('declining marks the request DECLINED without creating a membership', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'OWNER',
      });
      prisma.barJoinRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        barId: BAR_ID,
        userId: OTHER_ID,
        status: 'PENDING',
      });
      prisma.barJoinRequest.update.mockResolvedValue({
        id: 'req-1',
        status: 'DECLINED',
      });

      const result = await service.respondToJoinRequest(
        BAR_ID,
        OWNER_ID,
        'req-1',
        false,
      );

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.barJoinRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'DECLINED' },
      });
      expect(result).toEqual({ id: 'req-1', status: 'DECLINED' });
    });
  });

  describe('searchUsers', () => {
    it('delegates to UsersService.search', async () => {
      usersService.search.mockResolvedValue([{ id: '1', username: 'bob' }]);

      const result = await service.searchUsers('bo');

      expect(usersService.search).toHaveBeenCalledWith('bo');
      expect(result).toEqual([{ id: '1', username: 'bob' }]);
    });
  });

  describe('generateInviteLink', () => {
    it('forbids a non-owner from generating a link', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'MEMBER',
      });

      await expect(
        service.generateInviteLink(BAR_ID, OTHER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('generates and stores a new token for the owner', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'OWNER',
      });
      (randomBytes as jest.Mock).mockReturnValue(
        Buffer.from('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', 'hex'),
      );
      prisma.bar.update.mockResolvedValue({
        id: BAR_ID,
        inviteToken: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      });

      const result = await service.generateInviteLink(BAR_ID, OWNER_ID);

      expect(prisma.bar.update).toHaveBeenCalledWith({
        where: { id: BAR_ID },
        data: { inviteToken: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4' },
      });
      expect(result).toEqual({
        inviteToken: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      });
    });
  });

  describe('previewInviteLink', () => {
    it('throws NotFoundException for an invalid token', async () => {
      prisma.bar.findUnique.mockResolvedValue(null);

      await expect(service.previewInviteLink('bad-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the bar name for a valid token', async () => {
      prisma.bar.findUnique.mockResolvedValue({
        id: BAR_ID,
        name: 'Chez Noa',
        inviteToken: 'tok-1',
      });

      const result = await service.previewInviteLink('tok-1');

      expect(prisma.bar.findUnique).toHaveBeenCalledWith({
        where: { inviteToken: 'tok-1' },
      });
      expect(result).toEqual({ barName: 'Chez Noa' });
    });
  });

  describe('joinViaInviteLink', () => {
    it('throws NotFoundException for an invalid token', async () => {
      prisma.bar.findUnique.mockResolvedValue(null);

      await expect(
        service.joinViaInviteLink('bad-token', OTHER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('is idempotent if the caller is already a member', async () => {
      prisma.bar.findUnique.mockResolvedValue({
        id: BAR_ID,
        name: 'Chez Noa',
        inviteToken: 'tok-1',
      });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'MEMBER',
      });

      const result = await service.joinViaInviteLink('tok-1', OTHER_ID);

      expect(prisma.barMembership.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        barId: BAR_ID,
        barName: 'Chez Noa',
        alreadyMember: true,
      });
    });

    it('creates a MEMBER membership for a new joiner', async () => {
      prisma.bar.findUnique.mockResolvedValue({
        id: BAR_ID,
        name: 'Chez Noa',
        inviteToken: 'tok-1',
      });
      prisma.barMembership.findUnique.mockResolvedValue(null);
      prisma.barMembership.create.mockResolvedValue({ id: 'm2' });

      const result = await service.joinViaInviteLink('tok-1', OTHER_ID);

      expect(prisma.barMembership.create).toHaveBeenCalledWith({
        data: { barId: BAR_ID, userId: OTHER_ID, role: 'MEMBER', vip: false },
      });
      expect(result).toEqual({
        barId: BAR_ID,
        barName: 'Chez Noa',
        alreadyMember: false,
      });
    });
  });

  describe('findAll', () => {
    it('returns every bar, public and private, with owner and member count', async () => {
      prisma.bar.findMany.mockResolvedValue([
        {
          id: 'bar-a',
          name: 'Bar Public',
          isPublic: true,
          createdAt: new Date('2026-01-01'),
          memberships: [{ role: 'OWNER', user: { username: 'owner1' } }],
          _count: { memberships: 1 },
        },
        {
          id: 'bar-b',
          name: 'Bar Privé',
          isPublic: false,
          createdAt: new Date('2026-01-02'),
          memberships: [{ role: 'OWNER', user: { username: 'owner2' } }],
          _count: { memberships: 3 },
        },
      ]);

      const result = await service.findAll();

      expect(prisma.bar.findMany).toHaveBeenCalledWith({
        include: {
          memberships: {
            select: { role: true, user: { select: { username: true } } },
          },
          _count: { select: { memberships: true } },
        },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([
        {
          id: 'bar-a',
          name: 'Bar Public',
          ownerUsername: 'owner1',
          memberCount: 1,
          isPublic: true,
          createdAt: new Date('2026-01-01'),
        },
        {
          id: 'bar-b',
          name: 'Bar Privé',
          ownerUsername: 'owner2',
          memberCount: 3,
          isPublic: false,
          createdAt: new Date('2026-01-02'),
        },
      ]);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException if the bar does not exist', async () => {
      prisma.bar.findUnique.mockResolvedValue(null);

      await expect(service.findOne(BAR_ID)).rejects.toThrow(NotFoundException);
    });

    it('returns bar details with member count and owner username', async () => {
      prisma.bar.findUnique.mockResolvedValue({
        id: BAR_ID,
        name: 'Chez Noa',
        isPublic: true,
        inviteToken: 'tok-1',
      });
      prisma.barMembership.count.mockResolvedValue(4);
      prisma.barMembership.findFirst.mockResolvedValue({
        user: { username: 'owner1' },
      });

      const result = await service.findOne(BAR_ID);

      expect(prisma.barMembership.count).toHaveBeenCalledWith({
        where: { barId: BAR_ID },
      });
      expect(prisma.barMembership.findFirst).toHaveBeenCalledWith({
        where: { barId: BAR_ID, role: 'OWNER' },
        include: { user: { select: { username: true } } },
      });
      expect(result).toEqual({
        id: BAR_ID,
        name: 'Chez Noa',
        isPublic: true,
        inviteToken: 'tok-1',
        memberCount: 4,
        ownerUsername: 'owner1',
      });
    });
  });
});
