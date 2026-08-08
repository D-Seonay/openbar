import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBottleDto } from './dto/create-bottle.dto';
import { UpdateBottleDto } from './dto/update-bottle.dto';
import { deleteUploadedImage } from './uploads';
import {
  LookedUpProduct,
  lookUpProduct,
  normaliseBarcode,
} from './product-lookup';

export type BarcodeLookupResult =
  | {
      status: 'existing';
      barcode: string;
      bottle: Awaited<ReturnType<BottlesService['findOne']>>;
    }
  | { status: 'product'; barcode: string; product: LookedUpProduct }
  | { status: 'unknown'; barcode: string };

@Injectable()
export class BottlesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(barId: string, includeVip: boolean) {
    return this.prisma.bottle.findMany({
      where: { barId, ...(includeVip ? {} : { vip: false }) },
      include: { volumes: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const bottle = await this.prisma.bottle.findUnique({
      where: { id },
      include: { volumes: true },
    });
    if (!bottle) throw new NotFoundException('Bouteille introuvable');
    return bottle;
  }

  async create(dto: CreateBottleDto) {
    const { volumes, barcode, ...rest } = dto;
    try {
      return await this.prisma.bottle.create({
        data: {
          ...rest,
          // Store digits only, matching what `lookupBarcode` searches on. An
          // unusable code is dropped rather than saved as-is, otherwise it
          // would never match a future scan.
          barcode: barcode ? normaliseBarcode(barcode) : null,
          volumes: volumes ? { create: volumes } : undefined,
        },
        include: { volumes: true },
      });
    } catch (error) {
      throw this.translateBarcodeConflict(error);
    }
  }

  /**
   * Resolve a scanned barcode, in order of usefulness to the person holding the
   * bottle: something already in this bar's stock, then whatever the public
   * product database knows, then nothing.
   *
   * `includeVip` mirrors `findAll`: a member who cannot see the VIP shelf must
   * not learn what is on it by scanning, so a VIP match is treated as no match
   * and falls through to the online lookup.
   */
  async lookupBarcode(
    barId: string,
    rawBarcode: string,
    includeVip: boolean,
  ): Promise<BarcodeLookupResult> {
    const barcode = normaliseBarcode(rawBarcode);
    if (!barcode) throw new BadRequestException('Code-barres invalide');

    const existing = await this.prisma.bottle.findFirst({
      where: { barId, barcode, ...(includeVip ? {} : { vip: false }) },
      include: { volumes: true },
    });
    if (existing) return { status: 'existing', barcode, bottle: existing };

    const product = await lookUpProduct(barcode);
    if (product) return { status: 'product', barcode, product };

    return { status: 'unknown', barcode };
  }

  async update(id: string, dto: UpdateBottleDto) {
    const previous = await this.findOne(id);
    const { volumes, barcode, ...rest } = dto;
    let updated: Awaited<ReturnType<typeof this.findOne>>;
    try {
      updated = await this.prisma.bottle.update({
        where: { id },
        data: {
          ...rest,
          // Same normalisation as `create`. `undefined` leaves the stored code
          // untouched; an explicit empty string clears it.
          ...(barcode === undefined
            ? {}
            : { barcode: barcode ? normaliseBarcode(barcode) : null }),
          ...(volumes ? { volumes: { deleteMany: {}, create: volumes } } : {}),
        },
        include: { volumes: true },
      });
    } catch (error) {
      throw this.translateBarcodeConflict(error);
    }

    // Swapping the image out orphans the previous file. `undefined` means the
    // field wasn't part of this patch, which must not delete anything; an empty
    // string means the image was cleared, which must. Runs after the update so
    // the row already points at the new value when we check for references.
    if (rest.imageUrl !== undefined && rest.imageUrl !== previous.imageUrl) {
      await this.deleteImageIfUnused(previous.imageUrl);
    }

    return updated;
  }

  async remove(id: string) {
    const bottle = await this.findOne(id);
    try {
      await this.prisma.bottle.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Impossible de supprimer cette bouteille : elle est référencée dans des ajustements de stock',
        );
      }
      throw error;
    }

    // Drop the uploaded file now that the row is gone, otherwise the volume
    // accumulates orphans forever. Done *after* the delete so a rejected
    // delete (P2003 above) never leaves a surviving bottle without its image.
    await this.deleteImageIfUnused(bottle.imageUrl);

    return { success: true };
  }

  /**
   * `@@unique([barId, barcode])` turns a duplicate scan into a raw P2002, which
   * would surface as a 500. Rewrite it into something the UI can show, and let
   * anything else through untouched.
   */
  private translateBarcodeConflict(error: unknown): unknown {
    // Prisma reports the violated fields as a string[] on `meta.target`, but
    // types it loosely, so narrow it before looking inside.
    const target = (error as { meta?: { target?: unknown } })?.meta?.target;
    const violatedBarcode =
      Array.isArray(target) && target.some((field) => field === 'barcode');

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      violatedBarcode
    ) {
      return new ConflictException(
        'Ce code-barres est déjà associé à une bouteille de ce bar',
      );
    }
    return error;
  }

  /**
   * Uploads get unique filenames, so normally nothing else points at this file.
   * But `imageUrl` is a free-form client-supplied string, so a bottle can be
   * saved pointing at another bottle's image — or at a user's avatar, which now
   * lives in the same directory. Check before unlinking.
   */
  private async deleteImageIfUnused(imageUrl: string | null) {
    if (!imageUrl) return;

    const [bottlesUsing, usersUsing] = await Promise.all([
      this.prisma.bottle.count({ where: { imageUrl } }),
      this.prisma.user.count({ where: { avatarUrl: imageUrl } }),
    ]);
    if (bottlesUsing > 0 || usersUsing > 0) return;

    await deleteUploadedImage(imageUrl);
  }
}
