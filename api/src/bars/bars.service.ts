import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
