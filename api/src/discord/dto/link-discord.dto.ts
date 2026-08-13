import { IsString, MaxLength, MinLength } from 'class-validator';

export class LinkDiscordDto {
  /** One-time authorisation code from Discord's redirect. */
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  code: string;
}
