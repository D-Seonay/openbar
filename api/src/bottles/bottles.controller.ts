import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { BarAccessService } from '../bars/bar-access.service';
import { BottlesService } from './bottles.service';
import { CreateBottleDto } from './dto/create-bottle.dto';
import { UpdateBottleDto } from './dto/update-bottle.dto';
import {
  buildUploadFilename,
  MAX_UPLOAD_BYTES,
  UPLOAD_EXTENSION_BY_MIME,
  UPLOADS_DIR,
} from './uploads';

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

  // Declared before `:id` so "lookup" is not swallowed as a bottle id.
  @Get('lookup')
  async lookup(
    @Req() req: Request,
    @Query('barId') barId: string,
    @Query('barcode') barcode: string,
  ) {
    const user = req.user as JwtPayload;
    if (!barId || !barcode) {
      throw new BadRequestException('barId et barcode sont requis');
    }
    const { canSeeVip } = await this.barAccessService.assertMember(barId, user);
    return this.bottlesService.lookupBarcode(barId, barcode, canSeeVip);
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
          const filename = buildUploadFilename(file.mimetype);
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
        if (!UPLOAD_EXTENSION_BY_MIME[file.mimetype]) {
          return callback(
            new BadRequestException(
              'Seuls les fichiers JPEG, PNG et WEBP sont autorisés',
            ),
            false,
          );
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
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(
      dto.barId,
      user,
    );
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException(
        'Seul le propriétaire du bar peut gérer le stock',
      );
    }
    return this.bottlesService.create(dto);
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateBottleDto,
  ) {
    const user = req.user as JwtPayload;
    const bottle = await this.bottlesService.findOne(id);
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(
      bottle.barId,
      user,
    );
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException(
        'Seul le propriétaire du bar peut gérer le stock',
      );
    }
    return this.bottlesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload;
    const bottle = await this.bottlesService.findOne(id);
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(
      bottle.barId,
      user,
    );
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException(
        'Seul le propriétaire du bar peut gérer le stock',
      );
    }
    return this.bottlesService.remove(id);
  }
}
