import { Module } from '@nestjs/common';
import { BottlesModule } from '../bottles/bottles.module';
import { RecipesModule } from '../recipes/recipes.module';
import { BarsModule } from '../bars/bars.module';
import { CocktailsService } from './cocktails.service';
import { CocktailsController } from './cocktails.controller';

@Module({
  imports: [BottlesModule, RecipesModule, BarsModule],
  controllers: [CocktailsController],
  providers: [CocktailsService],
})
export class CocktailsModule {}
