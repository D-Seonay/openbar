import { Test } from '@nestjs/testing';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';

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

  it('slugifies the event name, stripping accents and spaces', async () => {
    prisma.event.findUnique.mockResolvedValue(null);
    prisma.event.create.mockImplementation(({ data }) => Promise.resolve(data));

    const event = await service.create({ name: 'Apéro du samedi', date: '2026-07-11' });

    expect(event.slug).toBe('apero-du-samedi');
  });

  it('appends a numeric suffix when the slug already exists', async () => {
    prisma.event.findUnique
      .mockResolvedValueOnce({ slug: 'apero-du-samedi' })
      .mockResolvedValueOnce(null);
    prisma.event.create.mockImplementation(({ data }) => Promise.resolve(data));

    const event = await service.create({ name: 'Apéro du samedi', date: '2026-07-18' });

    expect(event.slug).toBe('apero-du-samedi-2');
  });
});
