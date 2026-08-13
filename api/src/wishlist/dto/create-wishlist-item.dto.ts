import {
  IsInt,
  IsOptional,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWishlistItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/\S/, {
    message: "label ne peut pas être composé uniquement d'espaces",
  })
  label: string;

  /**
   * How many guests are wanted for this item. Absent means 1, which is what
   * every item did before this field existed. Capped so a typo cannot ask for
   * a thousand people.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  neededCount?: number;
}
