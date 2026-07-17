import { IsString, MinLength } from 'class-validator';

export class CreateBarDto {
  @IsString()
  @MinLength(1)
  name: string;
}
