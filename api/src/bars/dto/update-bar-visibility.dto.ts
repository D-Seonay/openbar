import { IsBoolean } from 'class-validator';

export class UpdateBarVisibilityDto {
  @IsBoolean()
  isPublic: boolean;
}
