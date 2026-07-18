import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateBottleDto } from './create-bottle.dto';

export class UpdateBottleDto extends PartialType(OmitType(CreateBottleDto, ['barId'] as const)) {}
