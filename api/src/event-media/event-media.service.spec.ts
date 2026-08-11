import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventMediaKind } from '@prisma/client';
import { promises as fsp } from 'fs';
import { join } from 'path';
import { EventMediaService } from './event-media.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { UPLOADS_DIR } from '../bottles/uploads';

describe('EventMediaService', () => {
  let service: EventMediaService;
  let prisma: { eventMedia: Record<string, jest.Mock> };
  let eventsService: { findBySlug: jest.Mock };

  beforeEach(async () => {
    prisma = {
      eventMedia: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };
    eventsService = { findBySlug: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        EventMediaService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsService, useValue: eventsService },
      ],
    }).compile();
    service = moduleRef.get(EventMediaService);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves the slug to an eventId before listing media', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });

    await service.findForEvent('apero-du-samedi-a1b2c3d4');

    expect(eventsService.findBySlug).toHaveBeenCalledWith(
      'apero-du-samedi-a1b2c3d4',
    );
    expect(prisma.eventMedia.findMany).toHaveBeenCalledWith({
      where: { eventId: 'event-1' },
      orderBy: { createdAt: 'asc' },
      include: { uploader: { select: { id: true, username: true } } },
    });
  });

  it('creates an upload row pointing at the stored file', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    const created = {
      id: 'media-1',
      eventId: 'event-1',
      kind: EventMediaKind.UPLOAD,
      url: '/uploads/media-123.png',
    };
    prisma.eventMedia.create.mockResolvedValue(created);
    const file = {
      filename: 'media-123.png',
      originalname: 'photo.jpg',
      mimetype: 'image/png',
    } as Express.Multer.File;

    const result = await service.createUpload('slug', 'user-1', file);

    expect(prisma.eventMedia.create).toHaveBeenCalledWith({
      data: {
        eventId: 'event-1',
        kind: EventMediaKind.UPLOAD,
        url: '/uploads/media-123.png',
        mimeType: 'image/png',
        fileName: 'photo.jpg',
        uploaderId: 'user-1',
      },
      include: { uploader: { select: { id: true, username: true } } },
    });
    expect(result).toEqual(created);
  });

  it('creates a drive link row', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    const created = {
      id: 'media-2',
      eventId: 'event-1',
      kind: EventMediaKind.DRIVE_LINK,
      url: 'https://drive.google.com/drive/folders/abc',
    };
    prisma.eventMedia.create.mockResolvedValue(created);

    const result = await service.createDriveLink(
      'slug',
      'user-1',
      'https://drive.google.com/drive/folders/abc',
    );

    expect(prisma.eventMedia.create).toHaveBeenCalledWith({
      data: {
        eventId: 'event-1',
        kind: EventMediaKind.DRIVE_LINK,
        url: 'https://drive.google.com/drive/folders/abc',
        uploaderId: 'user-1',
      },
      include: { uploader: { select: { id: true, username: true } } },
    });
    expect(result).toEqual(created);
  });

  it('rejects removing media that does not exist', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.eventMedia.findUnique.mockResolvedValue(null);

    await expect(service.remove('slug', 'missing')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.eventMedia.delete).not.toHaveBeenCalled();
  });

  it('rejects removing media from a different event', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.eventMedia.findUnique.mockResolvedValue({
      id: 'media-1',
      eventId: 'event-2',
    });

    await expect(service.remove('slug', 'media-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.eventMedia.delete).not.toHaveBeenCalled();
  });

  it('returns a media row scoped to the event slug', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.eventMedia.findUnique.mockResolvedValue({
      id: 'media-1',
      eventId: 'event-1',
    });

    const result = await service.findOneForEvent('slug', 'media-1');

    expect(result).toEqual({ id: 'media-1', eventId: 'event-1' });
  });

  describe('collectArchiveEntries', () => {
    /** Point the resolver at files that really exist, inside UPLOADS_DIR. */
    async function withRealUploads(
      files: string[],
      run: () => Promise<void>,
    ): Promise<void> {
      await fsp.mkdir(UPLOADS_DIR, { recursive: true });
      const written = files.map((name) => join(UPLOADS_DIR, name));
      await Promise.all(written.map((p) => fsp.writeFile(p, 'x')));
      try {
        await run();
      } finally {
        await Promise.all(
          written.map((p) => fsp.rm(p, { force: true }).catch(() => undefined)),
        );
      }
    }

    it('asks only for this event’s uploads, never the shared album links', async () => {
      eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
      prisma.eventMedia.findMany.mockResolvedValue([]);

      await service.collectArchiveEntries('slug');

      expect(prisma.eventMedia.findMany).toHaveBeenCalledWith({
        where: { eventId: 'event-1', kind: EventMediaKind.UPLOAD },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('names each entry after the file the guest uploaded', async () => {
      const stored = 'media-archive-test-a.jpg';
      await withRealUploads([stored], async () => {
        eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
        prisma.eventMedia.findMany.mockResolvedValue([
          { url: `/uploads/${stored}`, fileName: 'Coucher de soleil.jpg' },
        ]);

        const entries = await service.collectArchiveEntries('slug');

        expect(entries).toEqual([
          { path: join(UPLOADS_DIR, stored), name: 'Coucher de soleil.jpg' },
        ]);
      });
    });

    it('suffixes duplicate names so an extractor keeps every photo', async () => {
      const stored = ['media-archive-test-b.jpg', 'media-archive-test-c.jpg'];
      await withRealUploads(stored, async () => {
        eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
        prisma.eventMedia.findMany.mockResolvedValue(
          stored.map((name) => ({
            url: `/uploads/${name}`,
            fileName: 'IMG_1234.jpg',
          })),
        );

        const entries = await service.collectArchiveEntries('slug');

        expect(entries.map((e) => e.name)).toEqual([
          'IMG_1234.jpg',
          'IMG_1234 (2).jpg',
        ]);
      });
    });

    it('skips a row whose file has gone missing rather than losing the rest', async () => {
      const present = 'media-archive-test-d.jpg';
      await withRealUploads([present], async () => {
        eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
        prisma.eventMedia.findMany.mockResolvedValue([
          { url: '/uploads/media-archive-test-gone.jpg', fileName: 'gone.jpg' },
          { url: `/uploads/${present}`, fileName: 'here.jpg' },
        ]);

        const entries = await service.collectArchiveEntries('slug');

        expect(entries.map((e) => e.name)).toEqual(['here.jpg']);
      });
    });

    it('drops a row whose url points outside the uploads directory', async () => {
      eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
      prisma.eventMedia.findMany.mockResolvedValue([
        { url: '/uploads/../../../etc/passwd', fileName: 'passwd' },
        { url: 'https://example.com/remote.jpg', fileName: 'remote.jpg' },
      ]);

      expect(await service.collectArchiveEntries('slug')).toEqual([]);
    });
  });
});
