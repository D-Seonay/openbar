import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SetDiscordChannelDto {
  /** Empty or absent clears the binding and stops the board publishing. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  channelId?: string;
}
