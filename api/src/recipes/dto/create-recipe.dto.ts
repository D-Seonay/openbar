import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsString } from 'class-validator';
import { RecipeDifficulty } from '@prisma/client';

export class CreateRecipeDto {
  @IsString()
  name: string;

  @IsString()
  glass: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  tags: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ingredientsList: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  instructions: string[];

  @IsString()
  prepTime: string;

  @IsEnum(RecipeDifficulty)
  difficulty: RecipeDifficulty;

  @IsString()
  description: string;

  @IsBoolean()
  vip: boolean;
}
