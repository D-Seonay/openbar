import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePollDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  question: string;

  /** Discord accepts between 2 and 10 answers. */
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  answers: string[];

  /** Hours the poll stays open. Defaults to a day. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(768)
  hours?: number;
}
