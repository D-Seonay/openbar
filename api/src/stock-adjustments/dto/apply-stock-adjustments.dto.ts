import { IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class StockChangeDto {
  @IsString()
  bottleId: string;

  @IsNumber()
  quantityAfter: number;
}

export class ApplyStockAdjustmentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockChangeDto)
  changes: StockChangeDto[];
}
