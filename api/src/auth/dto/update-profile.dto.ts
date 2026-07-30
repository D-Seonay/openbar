import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsDateString()
  birthday?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  favoriteDrink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  allergies?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
