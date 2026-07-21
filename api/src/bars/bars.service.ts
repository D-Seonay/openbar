import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

const MEMBER_INCLUDE = { user: { select: { username: true } } } as const;

@Injectable()
export class BarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async create(name: string, userId: string) {
    const existingOwnership = await this.prisma.barMembership.findFirst({
      where: { userId, role: 'OWNER' },
    });
    if (existingOwnership) {
      throw new ConflictException('Vous possédez déjà un bar');
    }

    return this.prisma.bar.create({
      data: {
        name,
        isPublic: false,
        memberships: { create: { userId, role: 'OWNER', vip: true } },
      },
      include: { memberships: true },
    });
  }

  async findMine(userId: string) {
    const bars = await this.prisma.bar.findMany({
      where: { memberships: { some: { userId } } },
      include: { memberships: { where: { userId } } },
      orderBy: { name: 'asc' },
    });

    return bars.map((bar) => ({
      id: bar.id,
      name: bar.name,
      createdAt: bar.createdAt,
      myRole: bar.memberships[0].role,
      myVip: bar.memberships[0].vip,
      isPublic: bar.isPublic,
      inviteToken: bar.memberships[0].role === 'OWNER' ? bar.inviteToken : null,
    }));
  }

  async findMembers(barId: string, userId: string) {
    await this.getBar(barId);
    const membership = await this.getMembership(barId, userId);
    if (!membership) {
      throw new ForbiddenException("Vous n'avez pas accès à ce bar");
    }

    return this.prisma.barMembership.findMany({
      where: { barId },
      include: MEMBER_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  async inviteMember(
    barId: string,
    requesterId: string,
    username: string,
    vip: boolean,
  ) {
    await this.assertOwner(barId, requesterId);

    const target = await this.usersService.findByUsername(username);
    if (!target) throw new NotFoundException('Utilisateur introuvable');

    const existing = await this.getMembership(barId, target.id);
    if (existing)
      throw new ConflictException('Cette personne a déjà accès à ce bar');

    return this.prisma.barMembership.create({
      data: { barId, userId: target.id, role: 'MEMBER', vip },
      include: MEMBER_INCLUDE,
    });
  }

  async updateMemberVip(
    barId: string,
    requesterId: string,
    membershipId: string,
    vip: boolean,
  ) {
    await this.assertOwner(barId, requesterId);

    const membership = await this.prisma.barMembership.findUnique({
      where: { id: membershipId },
    });
    if (!membership || membership.barId !== barId)
      throw new NotFoundException('Membre introuvable');
    if (membership.role === 'OWNER') {
      throw new ForbiddenException(
        'Impossible de modifier le statut du propriétaire',
      );
    }

    return this.prisma.barMembership.update({
      where: { id: membershipId },
      data: { vip },
      include: MEMBER_INCLUDE,
    });
  }

  async removeMember(barId: string, requesterId: string, membershipId: string) {
    await this.getBar(barId);

    const membership = await this.prisma.barMembership.findUnique({
      where: { id: membershipId },
    });
    if (!membership || membership.barId !== barId)
      throw new NotFoundException('Membre introuvable');
    if (membership.role === 'OWNER') {
      throw new ForbiddenException(
        'Impossible de retirer le propriétaire du bar',
      );
    }

    const requesterMembership = await this.getMembership(barId, requesterId);
    const isOwner = requesterMembership?.role === 'OWNER';
    const isSelf = membership.userId === requesterId;
    if (!isOwner && !isSelf) {
      throw new ForbiddenException(
        'Vous ne pouvez retirer que vous-même, ou être le propriétaire du bar',
      );
    }

    await this.prisma.barMembership.delete({ where: { id: membershipId } });
    return { success: true as const };
  }

  async setPublic(barId: string, requesterId: string, isPublic: boolean) {
    await this.assertOwner(barId, requesterId);
    const bar = await this.prisma.bar.update({
      where: { id: barId },
      data: { isPublic },
    });
    return { id: bar.id, isPublic: bar.isPublic };
  }

  async rename(barId: string, requesterId: string, name: string) {
    await this.assertOwner(barId, requesterId);
    const bar = await this.prisma.bar.update({
      where: { id: barId },
      data: { name },
    });
    return { id: bar.id, name: bar.name };
  }

  searchUsers(query: string) {
    return this.usersService.search(query);
  }

  async generateInviteLink(barId: string, requesterId: string) {
    await this.assertOwner(barId, requesterId);
    const inviteToken = randomBytes(16).toString('hex');
    await this.prisma.bar.update({
      where: { id: barId },
      data: { inviteToken },
    });
    return { inviteToken };
  }

  async previewInviteLink(token: string) {
    const bar = await this.prisma.bar.findUnique({ where: { inviteToken: token } });
    if (!bar) throw new NotFoundException("Lien d'invitation invalide");
    return { barName: bar.name };
  }

  async joinViaInviteLink(token: string, userId: string) {
    const bar = await this.prisma.bar.findUnique({ where: { inviteToken: token } });
    if (!bar) throw new NotFoundException("Lien d'invitation invalide");

    const existing = await this.getMembership(bar.id, userId);
    if (existing) {
      return { barId: bar.id, barName: bar.name, alreadyMember: true };
    }

    await this.prisma.barMembership.create({
      data: { barId: bar.id, userId, role: 'MEMBER', vip: false },
    });
    return { barId: bar.id, barName: bar.name, alreadyMember: false };
  }

  async findDirectory(userId?: string) {
    const bars = await this.prisma.bar.findMany({
      where: { isPublic: true },
      include: {
        memberships: {
          select: { userId: true, role: true, user: { select: { username: true } } },
        },
        _count: { select: { memberships: true } },
      },
      orderBy: { name: 'asc' },
    });

    let pendingBarIds = new Set<string>();
    if (userId) {
      const pendingRequests = await this.prisma.barJoinRequest.findMany({
        where: { userId, status: 'PENDING' },
        select: { barId: true },
      });
      pendingBarIds = new Set(pendingRequests.map((r) => r.barId));
    }

    return bars.map((bar) => {
      const owner = bar.memberships.find((m) => m.role === 'OWNER');
      const myMembership = userId ? bar.memberships.find((m) => m.userId === userId) : undefined;

      let myStatus: 'OWNER' | 'MEMBER' | 'PENDING' | 'NONE' = 'NONE';
      if (myMembership?.role === 'OWNER') myStatus = 'OWNER';
      else if (myMembership) myStatus = 'MEMBER';
      else if (pendingBarIds.has(bar.id)) myStatus = 'PENDING';

      return {
        id: bar.id,
        name: bar.name,
        ownerUsername: owner?.user.username ?? '—',
        memberCount: bar._count.memberships,
        myStatus,
      };
    });
  }

  async createJoinRequest(barId: string, userId: string) {
    const bar = await this.getBar(barId);
    if (!bar.isPublic) {
      throw new ForbiddenException('Ce bar est privé');
    }

    const membership = await this.getMembership(barId, userId);
    if (membership) {
      throw new ConflictException('Vous êtes déjà membre de ce bar');
    }

    const existing = await this.prisma.barJoinRequest.findUnique({
      where: { barId_userId: { barId, userId } },
    });

    if (existing?.status === 'PENDING') {
      throw new ConflictException('Vous avez déjà une demande en attente pour ce bar');
    }

    if (existing) {
      return this.prisma.barJoinRequest.update({
        where: { id: existing.id },
        data: { status: 'PENDING' },
      });
    }

    return this.prisma.barJoinRequest.create({
      data: { barId, userId, status: 'PENDING' },
    });
  }

  async findPendingRequests(barId: string, requesterId: string) {
    await this.assertOwner(barId, requesterId);

    return this.prisma.barJoinRequest.findMany({
      where: { barId, status: 'PENDING' },
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async respondToJoinRequest(
    barId: string,
    requesterId: string,
    requestId: string,
    accept: boolean,
  ) {
    await this.assertOwner(barId, requesterId);

    const request = await this.prisma.barJoinRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.barId !== barId) {
      throw new NotFoundException('Demande introuvable');
    }
    if (request.status !== 'PENDING') {
      throw new ConflictException('Cette demande a déjà été traitée');
    }

    if (accept) {
      const existingMembership = await this.getMembership(
        barId,
        request.userId,
      );
      if (existingMembership) {
        throw new ConflictException('Cet utilisateur est déjà membre de ce bar');
      }

      const [, updated] = await this.prisma.$transaction([
        this.prisma.barMembership.create({
          data: { barId, userId: request.userId, role: 'MEMBER', vip: false },
        }),
        this.prisma.barJoinRequest.update({
          where: { id: requestId },
          data: { status: 'ACCEPTED' },
        }),
      ]);
      return updated;
    }

    return this.prisma.barJoinRequest.update({
      where: { id: requestId },
      data: { status: 'DECLINED' },
    });
  }

  private async getBar(barId: string) {
    const bar = await this.prisma.bar.findUnique({ where: { id: barId } });
    if (!bar) throw new NotFoundException('Bar introuvable');
    return bar;
  }

  getMembership(barId: string, userId: string) {
    return this.prisma.barMembership.findUnique({
      where: { barId_userId: { barId, userId } },
    });
  }

  private async assertOwner(barId: string, userId: string) {
    await this.getBar(barId);
    const membership = await this.getMembership(barId, userId);
    if (!membership || membership.role !== 'OWNER') {
      throw new ForbiddenException(
        'Seul le propriétaire du bar peut effectuer cette action',
      );
    }
  }
}
