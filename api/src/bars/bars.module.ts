import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { BarsService } from './bars.service';
import { BarsController } from './bars.controller';

@Module({
  imports: [UsersModule],
  controllers: [BarsController],
  providers: [BarsService],
  exports: [BarsService],
})
export class BarsModule {}
