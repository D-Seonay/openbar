import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class InviteMemberDto {
  @IsString()
  username: string;

  @IsOptional()
  @IsBoolean()
  vip?: boolean;
}
