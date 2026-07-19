import { IsBoolean } from 'class-validator';

export class RespondJoinRequestDto {
  @IsBoolean()
  accept: boolean;
}
