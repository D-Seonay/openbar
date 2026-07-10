import { Module } from '@nestjs/common';
import { BottlesModule } from '../bottles/bottles.module';
import { CocktailsService } from './cocktails.service';
import { CocktailsController } from './cocktails.controller';

@Module({
  imports: [BottlesModule],
  controllers: [CocktailsController],
  providers: [CocktailsService],
})
export class CocktailsModule {}
