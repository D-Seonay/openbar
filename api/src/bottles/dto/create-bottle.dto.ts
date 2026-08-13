import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
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

  /**
   * `null` clears the alert. Allowing it explicitly matters: `undefined` means
   * "leave untouched" on a PATCH, so without this a threshold set once could
   * never be removed.
   */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  lowStockThreshold?: number | null;

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
