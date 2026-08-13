import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BarsModule } from '../bars/bars.module';

/**
 * Global so any service can record without every module importing it — the
 * whole point is that recording is cheap to add at a new call site.
 */
@Global()
@Module({
  imports: [PrismaModule, BarsModule],
  providers: [AuditService],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
