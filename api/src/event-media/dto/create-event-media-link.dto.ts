import { IsUrl } from 'class-validator';

export class CreateEventMediaLinkDto {
  @IsUrl()
  url!: string;
}
