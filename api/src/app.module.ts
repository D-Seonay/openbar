import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { BottlesModule } from './bottles/bottles.module';
import { CocktailsModule } from './cocktails/cocktails.module';
import { EventsModule } from './events/events.module';
import { ContributionsModule } from './contributions/contributions.module';
import { StockAdjustmentsModule } from './stock-adjustments/stock-adjustments.module';
import { RecipesModule } from './recipes/recipes.module';
import { BarsModule } from './bars/bars.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { EventMediaModule } from './event-media/event-media.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    BottlesModule,
    CocktailsModule,
    EventsModule,
    ContributionsModule,
    WishlistModule,
    EventMediaModule,
    StockAdjustmentsModule,
    RecipesModule,
    BarsModule,
  ],
})
export class AppModule {}
