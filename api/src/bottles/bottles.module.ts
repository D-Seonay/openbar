import { Module } from '@nestjs/common';
import { BottlesService } from './bottles.service';
import { BottlesController } from './bottles.controller';

@Module({
  controllers: [BottlesController],
  providers: [BottlesService],
  exports: [BottlesService],
})
export class BottlesModule {}
