import { IsDateString, IsString } from 'class-validator';

export class CreateEventDto {
  @IsString()
  barId: string;

  @IsString()
  name: string;

  @IsDateString()
  date: string;
}
