import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SALT_ROUNDS = 10;

const PUBLIC_SELECT = { id: true, username: true, role: true, vip: true, createdAt: true } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: { username: string; password: string; role?: Role; vip?: boolean }) {
    const existing = await this.prisma.user.findUnique({ where: { username: input.username } });
    if (existing) throw new ConflictException("Ce nom d'utilisateur existe déjà");

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    return this.prisma.user.create({
      data: {
        username: input.username,
        passwordHash,
        role: input.role ?? 'USER',
        vip: input.vip ?? false,
      },
      select: PUBLIC_SELECT,
    });
  }

  findAll() {
    return this.prisma.user.findMany({ select: PUBLIC_SELECT, orderBy: { username: 'asc' } });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async update(id: string, input: { role?: Role; vip?: boolean }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return this.prisma.user.update({ where: { id }, data: input, select: PUBLIC_SELECT });
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }
}
