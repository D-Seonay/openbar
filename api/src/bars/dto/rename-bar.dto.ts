import { IsString, MinLength } from 'class-validator';

export class RenameBarDto {
  @IsString()
  @MinLength(1)
  name: string;
}
