import { Module } from '@nestjs/common';
import { BarsModule } from '../bars/bars.module';
import { BottlesService } from './bottles.service';
import { BottlesController } from './bottles.controller';

@Module({
  imports: [BarsModule],
  controllers: [BottlesController],
  providers: [BottlesService],
  exports: [BottlesService],
})
export class BottlesModule {}
