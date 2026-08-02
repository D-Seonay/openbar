import { IsString, MinLength } from 'class-validator';

export class CreateWishlistItemDto {
  @IsString()
  @MinLength(1)
  label: string;
}
