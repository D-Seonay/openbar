import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateWishlistItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/\S/, {
    message: "label ne peut pas être composé uniquement d'espaces",
  })
  label: string;
}
