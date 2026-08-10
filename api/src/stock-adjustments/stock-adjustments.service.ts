import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { ApplyStockAdjustmentsDto } from './dto/apply-stock-adjustments.dto';

@Injectable()
export class StockAdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  async findForEvent(slug: string) {
    const event = await this.eventsService.findBySlug(slug);
    return this.prisma.stockAdjustment.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async apply(slug: string, dto: ApplyStockAdjustmentsDto) {
    const event = await this.eventsService.findBySlug(slug);
    const created: Awaited<
      ReturnType<typeof this.prisma.stockAdjustment.create>
    >[] = [];

    for (const change of dto.changes) {
      const bottle = await this.prisma.bottle.findUnique({
        where: { id: change.bottleId },
        include: { volumes: true },
      });
      if (!bottle) continue;

      const quantityBefore = bottle.quantity;
      const quantityAfter = Math.max(0, change.quantityAfter);
      if (quantityBefore === quantityAfter) continue;

      const diff = quantityBefore - quantityAfter;

      const adjustment = await this.prisma.$transaction(async (tx) => {
        if (bottle.volumes.length > 0) {
          if (diff > 0) {
            let toRemove = diff;
            for (
              let i = bottle.volumes.length - 1;
              i >= 0 && toRemove > 0;
              i--
            ) {
              const vol = bottle.volumes[i];
              const removeHere = Math.min(vol.quantity, toRemove);
              if (removeHere > 0) {
                await tx.bottleVolume.update({
                  where: { id: vol.id },
                  data: { quantity: vol.quantity - removeHere },
                });
              }
              toRemove -= removeHere;
            }
            await tx.bottleVolume.deleteMany({
              where: { bottleId: bottle.id, quantity: { lte: 0 } },
            });
          } else if (diff < 0) {
            const added = Math.abs(diff);
            const firstVolume = bottle.volumes[0];
            await tx.bottleVolume.update({
              where: { id: firstVolume.id },
              data: { quantity: firstVolume.quantity + added },
            });
          }
        }

        await tx.bottle.update({
          where: { id: bottle.id },
          data: { quantity: quantityAfter },
        });

        return tx.stockAdjustment.create({
          data: {
            eventId: event.id,
            bottleId: bottle.id,
            bottleName: bottle.name,
            quantityBefore,
            quantityAfter,
          },
        });
      });
      created.push(adjustment);
    }

    await this.prisma.event.update({
      where: { id: event.id },
      data: { isClosed: true },
    });

    return created;
  }
}
