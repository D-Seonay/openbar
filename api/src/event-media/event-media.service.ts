import { Injectable, NotFoundException } from '@nestjs/common';
import { EventMediaKind } from '@prisma/client';
import { promises as fsp } from 'fs';
import { basename, extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import {
  deleteUploadedImage,
  resolveUploadPath,
  safeArchiveEntryName,
} from '../bottles/uploads';

/** One file to put in the archive: where it lives, and what to call it. */
export interface ArchiveEntry {
  path: string;
  name: string;
}

/**
 * Guests routinely upload several `IMG_1234.jpg` from different phones. A zip
 * tolerates duplicate entry names but most extractors silently keep only one,
 * so suffix collisions instead: `IMG_1234 (2).jpg`.
 */
function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }

  const ext = extname(name);
  const stem = name.slice(0, name.length - ext.length);
  let counter = 2;
  let candidate = `${stem} (${counter})${ext}`;
  while (used.has(candidate)) {
    counter += 1;
    candidate = `${stem} (${counter})${ext}`;
  }
  used.add(candidate);
  return candidate;
}

@Injectable()
export class EventMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  async findForEvent(slug: string) {
    const event = await this.eventsService.findBySlug(slug);
    return this.prisma.eventMedia.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'asc' },
      include: {
        uploader: { select: { id: true, username: true } },
      },
    });
  }

  async createUpload(
    slug: string,
    uploaderId: string,
    file: Express.Multer.File,
  ) {
    const event = await this.eventsService.findBySlug(slug);
    return this.prisma.eventMedia.create({
      data: {
        eventId: event.id,
        kind: EventMediaKind.UPLOAD,
        url: `/uploads/${file.filename}`,
        mimeType: file.mimetype,
        fileName: file.originalname,
        uploaderId,
      },
      include: {
        uploader: { select: { id: true, username: true } },
      },
    });
  }

  async createDriveLink(slug: string, uploaderId: string, url: string) {
    const event = await this.eventsService.findBySlug(slug);
    return this.prisma.eventMedia.create({
      data: {
        eventId: event.id,
        kind: EventMediaKind.DRIVE_LINK,
        url,
        uploaderId,
      },
      include: {
        uploader: { select: { id: true, username: true } },
      },
    });
  }

  async remove(slug: string, id: string) {
    const event = await this.eventsService.findBySlug(slug);
    const media = await this.prisma.eventMedia.findUnique({ where: { id } });
    if (!media || media.eventId !== event.id) {
      throw new NotFoundException('Média introuvable');
    }
    await this.prisma.eventMedia.delete({ where: { id } });
    if (media.kind === EventMediaKind.UPLOAD) {
      await deleteUploadedImage(media.url);
    }
    return { success: true };
  }

  /**
   * The files that make up this event's "download everything" archive.
   *
   * Only `UPLOAD` media qualify: a `DRIVE_LINK` is somebody else's album, with
   * nothing of ours on disk to put in a zip. Rows whose file has gone missing
   * are skipped rather than failing the whole archive — one lost photo must not
   * cost the guest the other forty.
   */
  async collectArchiveEntries(slug: string): Promise<ArchiveEntry[]> {
    const event = await this.eventsService.findBySlug(slug);
    const media = await this.prisma.eventMedia.findMany({
      where: { eventId: event.id, kind: EventMediaKind.UPLOAD },
      orderBy: { createdAt: 'asc' },
    });

    const entries: ArchiveEntry[] = [];
    const usedNames = new Set<string>();

    for (const item of media) {
      const path = resolveUploadPath(item.url);
      if (!path) continue;
      try {
        await fsp.access(path);
      } catch {
        continue;
      }

      const storedName = basename(path);
      entries.push({
        path,
        name: uniqueName(
          safeArchiveEntryName(item.fileName, storedName),
          usedNames,
        ),
      });
    }

    return entries;
  }

  async findOneForEvent(slug: string, id: string) {
    const event = await this.eventsService.findBySlug(slug);
    const media = await this.prisma.eventMedia.findUnique({ where: { id } });
    if (!media || media.eventId !== event.id) {
      throw new NotFoundException('Média introuvable');
    }
    return media;
  }
}
