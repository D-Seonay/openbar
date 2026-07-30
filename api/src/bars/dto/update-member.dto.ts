import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsBoolean()
  vip?: boolean;

  @IsOptional()
  @IsString()
  role?: 'OWNER' | 'MEMBER';
}
