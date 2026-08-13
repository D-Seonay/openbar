import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(1)
  password: string;

  /**
   * "Rester connecté". Omitted means yes, so an older client that does not send
   * the field keeps the session length it had before this existed.
   */
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
