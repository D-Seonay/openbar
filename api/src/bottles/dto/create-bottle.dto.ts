import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BottleType } from '@prisma/client';

class BottleVolumeDto {
  @IsString()
  size: string;

  @IsNumber()
  quantity: number;
}

export class CreateBottleDto {
  @IsString()
  barId: string;

  @IsString()
  name: string;

  @IsEnum(BottleType)
  type: BottleType;

  @IsNumber()
  quantity: number;

  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @IsBoolean()
  vip: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BottleVolumeDto)
  volumes?: BottleVolumeDto[];
}
