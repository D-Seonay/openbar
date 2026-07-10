import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { BottlesModule } from './bottles/bottles.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, BottlesModule],
})
export class AppModule {}
