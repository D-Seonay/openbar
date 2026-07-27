import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
    const existing = await this.prisma.user.findUnique({ where: { username: input.username } });
    if (existing) throw new ConflictException("Ce nom d'utilisateur existe déjà");

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

  findAll() {
    return this.prisma.user.findMany({ select: PUBLIC_SELECT, orderBy: { username: 'asc' } });
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
    input: { role?: Role; vip?: boolean; password?: string; mustChangePassword?: boolean },
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

    return this.prisma.user.update({ where: { id }, data, select: PUBLIC_SELECT });
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(
          "Impossible de supprimer cet utilisateur : il a des contributions associées",
        );
      }
      throw error;
    }
    return { success: true };
  }
}
