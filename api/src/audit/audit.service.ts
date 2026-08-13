import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/auth.service';

export interface AuditEntryInput {
  /** Omit for actions that are not scoped to a bar (account administration). */
  barId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  /** Already in French: the page displays it as-is. */
  summary: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record an action, never failing the request that caused it.
   *
   * A trail is worth having, but not at the price of a bottle that refuses to
   * save because the audit insert failed. Losing an entry is recoverable;
   * refusing the user's actual work is not — so this swallows and logs.
   */
  async record(
    actor: JwtPayload | undefined,
    entry: AuditEntryInput,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          barId: entry.barId ?? null,
          actorId: actor?.sub ?? null,
          // Copied rather than joined, so the entry stays readable once the
          // account is archived and the relation is nulled out.
          actorName: actor?.username ?? 'système',
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId ?? null,
          summary: entry.summary,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Journal: entrée "${entry.action}" non enregistrée : ${String(error)}`,
      );
    }
  }

  /** Newest first — a journal is read from the top. */
  async findForBar(barId: string, take: number, skip: number) {
    const [entries, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { barId },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.auditLog.count({ where: { barId } }),
    ]);
    return { entries, total };
  }
}
