import { Injectable, NotFoundException } from '@nestjs/common';
import { EventMediaKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { deleteUploadedImage } from '../bottles/uploads';

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

  async findOneForEvent(slug: string, id: string) {
    const event = await this.eventsService.findBySlug(slug);
    const media = await this.prisma.eventMedia.findUnique({ where: { id } });
    if (!media || media.eventId !== event.id) {
      throw new NotFoundException('Média introuvable');
    }
    return media;
  }
}
