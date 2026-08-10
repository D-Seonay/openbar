import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { BarAccessService } from '../bars/bar-access.service';
import { EventsService } from '../events/events.service';
import { EventMediaService } from './event-media.service';
import { CreateEventMediaLinkDto } from './dto/create-event-media-link.dto';
import {
  buildMediaUploadFilename,
  MAX_MEDIA_UPLOAD_BYTES,
  MEDIA_EXTENSION_BY_MIME,
  UPLOADS_DIR,
} from '../bottles/uploads';

@UseGuards(JwtAuthGuard)
@Controller('events/:slug/media')
export class EventMediaController {
  constructor(
    private readonly eventMediaService: EventMediaService,
    private readonly eventsService: EventsService,
    private readonly barAccessService: BarAccessService,
  ) {}

  @Get()
  async findAll(@Param('slug') slug: string, @Req() req: Request) {
    const user = req.user as JwtPayload;
    const event = await this.eventsService.findBySlug(slug);
    await this.barAccessService.assertMember(event.barId, user);
    return this.eventMediaService.findForEvent(slug);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, callback) => {
          const filename = buildMediaUploadFilename(file.mimetype);
          if (!filename) {
            return callback(
              new BadRequestException('Type de fichier non autorisé'),
              '',
            );
          }
          callback(null, filename);
        },
      }),
      fileFilter: (_req, file, callback) => {
        if (!MEDIA_EXTENSION_BY_MIME[file.mimetype]) {
          return callback(
            new BadRequestException(
              'Seules les photos (JPEG, PNG, WEBP, GIF) et vidéos (MP4, WEBM, MOV) sont autorisées',
            ),
            false,
          );
        }
        callback(null, true);
      },
      limits: { fileSize: MAX_MEDIA_UPLOAD_BYTES, files: 1 },
    }),
  )
  async upload(
    @Param('slug') slug: string,
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const user = req.user as JwtPayload;
    if (!file) {
      throw new BadRequestException('Aucun fichier téléchargé');
    }
    const event = await this.eventsService.findBySlug(slug);
    await this.barAccessService.assertMember(event.barId, user);
    return this.eventMediaService.createUpload(slug, user.sub, file);
  }

  @Post('link')
  async createLink(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Body() dto: CreateEventMediaLinkDto,
  ) {
    const user = req.user as JwtPayload;
    const event = await this.eventsService.findBySlug(slug);
    await this.barAccessService.assertMember(event.barId, user);
    return this.eventMediaService.createDriveLink(slug, user.sub, dto.url);
  }

  @Delete(':id')
  async remove(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    const event = await this.eventsService.findBySlug(slug);
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(
      event.barId,
      user,
    );
    const media = await this.eventMediaService.findOneForEvent(slug, id);
    if (media.uploaderId !== user.sub && !isOwnerOrAdmin) {
      throw new ForbiddenException(
        "Vous ne pouvez retirer que vos propres médias, ou ceux d'une soirée dont vous êtes l'hôte",
      );
    }
    return this.eventMediaService.remove(slug, id);
  }
}
