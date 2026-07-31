import { 
  Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { join } from 'path';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { BarAccessService } from '../bars/bar-access.service';
import { BottlesService } from './bottles.service';
import { CreateBottleDto } from './dto/create-bottle.dto';
import { UpdateBottleDto } from './dto/update-bottle.dto';

/**
 * Accepted upload types, mapped to the extension the file is stored under.
 *
 * The stored extension MUST come from this table and never from the client's
 * `originalname`: `mimetype` is client-controlled too, so a file named
 * `evil.html` sent as `image/png` would otherwise land on disk as `.html` and
 * be served as markup by the static handler — stored XSS on the API origin,
 * which shares cookies with the web app (cookies ignore the port).
 */
const UPLOAD_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const UPLOADS_DIR = join(process.cwd(), 'uploads');
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// multer's diskStorage does not create the destination for us.
mkdirSync(UPLOADS_DIR, { recursive: true });

@UseGuards(JwtAuthGuard)
@Controller('bottles')
export class BottlesController {
  constructor(
    private readonly bottlesService: BottlesService,
    private readonly barAccessService: BarAccessService,
  ) {}

  @Get()
  async findAll(@Req() req: Request, @Query('barId') barId: string) {
    const user = req.user as JwtPayload;
    const { canSeeVip } = await this.barAccessService.assertMember(barId, user);
    return this.bottlesService.findAll(barId, canSeeVip);
  }

  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload;
    const bottle = await this.bottlesService.findOne(id);
    await this.barAccessService.assertMember(bottle.barId, user);
    return bottle;
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, callback) => {
          // fileFilter runs first, so the mimetype is known-good here.
          const ext = UPLOAD_EXTENSION_BY_MIME[file.mimetype];
          if (!ext) {
            return callback(new BadRequestException('Type de fichier non autorisé'), '');
          }
          callback(null, `bottle-${Date.now()}-${randomUUID()}${ext}`);
        },
      }),
      fileFilter: (_req, file, callback) => {
        if (!UPLOAD_EXTENSION_BY_MIME[file.mimetype]) {
          return callback(new BadRequestException('Seuls les fichiers JPEG, PNG et WEBP sont autorisés'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Aucun fichier téléchargé');
    }
    return { imageUrl: `/uploads/${file.filename}` };
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateBottleDto) {
    const user = req.user as JwtPayload;
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(dto.barId, user);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Seul le propriétaire du bar peut gérer le stock');
    }
    return this.bottlesService.create(dto);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateBottleDto) {
    const user = req.user as JwtPayload;
    const bottle = await this.bottlesService.findOne(id);
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(bottle.barId, user);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Seul le propriétaire du bar peut gérer le stock');
    }
    return this.bottlesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload;
    const bottle = await this.bottlesService.findOne(id);
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(bottle.barId, user);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Seul le propriétaire du bar peut gérer le stock');
    }
    return this.bottlesService.remove(id);
  }
}
