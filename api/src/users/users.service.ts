import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import type { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SALT_ROUNDS = 10;

const PUBLIC_SELECT = {
  id: true,
  username: true,
  role: true,
  vip: true,
  createdAt: true,
  mustChangePassword: true,
  birthday: true,
  favoriteDrink: true,
  allergies: true,
  avatarUrl: true,
  discordUserId: true,
  discordUsername: true,
  isArchived: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    username: string;
    password: string;
    role?: Role;
    vip?: boolean;
    mustChangePassword?: boolean;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { username: input.username },
    });
    if (existing)
      throw new ConflictException("Ce nom d'utilisateur existe déjà");

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    return this.prisma.user.create({
      data: {
        username: input.username,
        passwordHash,
        role: input.role ?? 'USER',
        vip: input.vip ?? false,
        mustChangePassword: input.mustChangePassword ?? false,
      },
      select: PUBLIC_SELECT,
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findPublicById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: PUBLIC_SELECT,
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      select: PUBLIC_SELECT,
      orderBy: { username: 'asc' },
    });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  search(query: string) {
    if (!query.trim()) return Promise.resolve([]);
    return this.prisma.user.findMany({
      where: { username: { contains: query, mode: 'insensitive' } },
      select: { id: true, username: true },
      orderBy: { username: 'asc' },
      take: 10,
    });
  }

  async update(
    id: string,
    input: {
      role?: Role;
      vip?: boolean;
      password?: string;
      mustChangePassword?: boolean;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const { password, mustChangePassword, ...rest } = input;
    const data: {
      role?: Role;
      vip?: boolean;
      passwordHash?: string;
      mustChangePassword?: boolean;
    } = { ...rest };
    if (password) {
      data.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      data.mustChangePassword = mustChangePassword ?? true;
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: PUBLIC_SELECT,
    });
  }

  async updateProfile(
    id: string,
    input: {
      birthday?: string;
      favoriteDrink?: string;
      allergies?: string;
      avatarUrl?: string;
    },
  ) {
    return this.prisma.user.update({
      where: { id },
      data: {
        birthday: input.birthday ? new Date(input.birthday) : null,
        favoriteDrink: input.favoriteDrink || null,
        allergies: input.allergies || null,
        avatarUrl: input.avatarUrl || null,
      },
      select: PUBLIC_SELECT,
    });
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        barMemberships: {
          where: { role: 'OWNER' },
          include: {
            bar: {
              include: {
                _count: {
                  select: { memberships: { where: { role: 'OWNER' } } },
                },
              },
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const barsToArchive = user.barMemberships
      .filter((m) => m.bar._count.memberships === 1)
      .map((m) => m.barId);

    await this.prisma.$transaction(async (tx) => {
      if (barsToArchive.length > 0) {
        await tx.bar.updateMany({
          where: { id: { in: barsToArchive } },
          data: { isArchived: true, isPublic: false, inviteToken: null },
        });
      }

      const archivedUsername = `${user.username}_archived_${Date.now()}`;

      await tx.user.update({
        where: { id },
        data: {
          isArchived: true,
          username: archivedUsername,
          passwordHash: 'ARCHIVED',
        },
      });
    });

    return { success: true };
  }
}
