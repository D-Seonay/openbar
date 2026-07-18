import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/auth.service';

describe('RecipesService', () => {
  let service: RecipesService;
  let prisma: { recipe: Record<string, jest.Mock> };

  const owner: JwtPayload = { sub: 'user-1', username: 'alice', role: 'USER', vip: true };
  const otherUser: JwtPayload = { sub: 'user-2', username: 'bob', role: 'USER', vip: true };
  const admin: JwtPayload = { sub: 'admin-1', username: 'root', role: 'ADMIN', vip: false };

  beforeEach(async () => {
    prisma = {
      recipe: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [RecipesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(RecipesService);
  });

  it('excludes VIP recipes from the query when includeVip is false', async () => {
    await service.findVisible('bar-1', false);

    expect(prisma.recipe.findMany).toHaveBeenCalledWith({
      where: { barId: 'bar-1', vip: false },
      include: { createdBy: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('does not filter by vip when includeVip is true', async () => {
    await service.findVisible('bar-1', true);

    expect(prisma.recipe.findMany).toHaveBeenCalledWith({
      where: { barId: 'bar-1' },
      include: { createdBy: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('throws NotFoundException when updating a recipe that does not exist', async () => {
    prisma.recipe.findUnique.mockResolvedValue(null);

    await expect(service.update('missing-id', { name: 'X' }, owner)).rejects.toThrow(NotFoundException);
  });

  it('allows the creator to update their own recipe', async () => {
    prisma.recipe.findUnique.mockResolvedValue({ id: 'recipe-1', createdById: owner.sub });
    prisma.recipe.update.mockResolvedValue({ id: 'recipe-1', name: 'Updated' });

    const result = await service.update('recipe-1', { name: 'Updated' }, owner);

    expect(result).toEqual({ id: 'recipe-1', name: 'Updated' });
    expect(prisma.recipe.update).toHaveBeenCalledWith({
      where: { id: 'recipe-1' },
      data: { name: 'Updated' },
      include: { createdBy: { select: { username: true } } },
    });
  });

  it('forbids a non-owner, non-admin from updating a recipe', async () => {
    prisma.recipe.findUnique.mockResolvedValue({ id: 'recipe-1', createdById: owner.sub });

    await expect(service.update('recipe-1', { name: 'Hacked' }, otherUser)).rejects.toThrow(ForbiddenException);
  });

  it('allows an admin to update any recipe', async () => {
    prisma.recipe.findUnique.mockResolvedValue({ id: 'recipe-1', createdById: owner.sub });
    prisma.recipe.update.mockResolvedValue({ id: 'recipe-1', name: 'Updated by admin' });

    const result = await service.update('recipe-1', { name: 'Updated by admin' }, admin);

    expect(result).toEqual({ id: 'recipe-1', name: 'Updated by admin' });
  });

  it('forbids a non-owner, non-admin from deleting a recipe', async () => {
    prisma.recipe.findUnique.mockResolvedValue({ id: 'recipe-1', createdById: owner.sub });

    await expect(service.remove('recipe-1', otherUser)).rejects.toThrow(ForbiddenException);
  });

  it('allows the creator to delete their own recipe', async () => {
    prisma.recipe.findUnique.mockResolvedValue({ id: 'recipe-1', createdById: owner.sub });
    prisma.recipe.delete.mockResolvedValue({ id: 'recipe-1' });

    const result = await service.remove('recipe-1', owner);

    expect(result).toEqual({ success: true });
    expect(prisma.recipe.delete).toHaveBeenCalledWith({ where: { id: 'recipe-1' } });
  });
});
