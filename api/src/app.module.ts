import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { BottlesModule } from './bottles/bottles.module';
import { CocktailsModule } from './cocktails/cocktails.module';
import { EventsModule } from './events/events.module';
import { ContributionsModule } from './contributions/contributions.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, BottlesModule, CocktailsModule, EventsModule, ContributionsModule],
})
export class AppModule {}
