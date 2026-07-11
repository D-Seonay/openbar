import { IsBoolean, IsEnum, IsOptional, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  vip?: boolean;

  @IsOptional()
  @MinLength(6)
  password?: string;
}
