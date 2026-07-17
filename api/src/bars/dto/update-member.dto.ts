import { IsBoolean } from 'class-validator';

export class UpdateMemberDto {
  @IsBoolean()
  vip: boolean;
}
