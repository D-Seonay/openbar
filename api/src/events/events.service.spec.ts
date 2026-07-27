import { Test } from '@nestjs/testing';
import { randomBytes } from 'crypto';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('crypto', () => ({ randomBytes: jest.fn() }));

describe('EventsService', () => {
  let service: EventsService;
  let prisma: { event: Record<string, jest.Mock> };

  beforeEach(async () => {
    prisma = {
      event: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [EventsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(EventsService);
  });

  it('slugifies the event name, stripping accents and spaces, and appends a random suffix', async () => {
    prisma.event.findUnique.mockResolvedValue(null);
    prisma.event.create.mockImplementation(({ data }) => Promise.resolve(data));
    (randomBytes as jest.Mock).mockReturnValue(Buffer.from('a1b2c3d4', 'hex'));

    const event = await service.create({ barId: 'bar-1', name: 'Apéro du samedi', date: '2026-07-11' });

    expect(event.slug).toBe('apero-du-samedi-a1b2c3d4');
    expect(event.slug).not.toBe('apero-du-samedi');
  });

  it('retries with a new random suffix when a collision occurs', async () => {
    prisma.event.findUnique
      .mockResolvedValueOnce({ slug: 'apero-du-samedi-a1b2c3d4' })
      .mockResolvedValueOnce(null);
    prisma.event.create.mockImplementation(({ data }) => Promise.resolve(data));
    (randomBytes as jest.Mock)
      .mockReturnValueOnce(Buffer.from('a1b2c3d4', 'hex'))
      .mockReturnValueOnce(Buffer.from('deadbeef', 'hex'));

    const event = await service.create({ barId: 'bar-1', name: 'Apéro du samedi', date: '2026-07-18' });

    expect(event.slug).toBe('apero-du-samedi-deadbeef');
  });

  it('scopes findAll to the given bar', async () => {
    await service.findAll('bar-1');

    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: { barId: 'bar-1' },
      orderBy: { date: 'asc' },
    });
  });
});
