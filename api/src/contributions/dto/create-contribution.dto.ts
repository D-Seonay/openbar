import { IsOptional, IsString } from 'class-validator';

export class CreateContributionDto {
  @IsString()
  item: string;

  @IsOptional()
  @IsString()
  quantity?: string;
}
