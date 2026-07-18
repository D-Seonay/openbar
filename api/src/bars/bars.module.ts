import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { BarsService } from './bars.service';
import { BarsController } from './bars.controller';
import { BarAccessService } from './bar-access.service';

@Module({
  imports: [UsersModule],
  controllers: [BarsController],
  providers: [BarsService, BarAccessService],
  exports: [BarsService, BarAccessService],
})
export class BarsModule {}
