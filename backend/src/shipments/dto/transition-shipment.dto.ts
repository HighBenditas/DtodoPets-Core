import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { maximumClpAmount } from '../../common/money/clp';
import { ShipmentStatus } from '../../generated/prisma/client';

export class TransitionShipmentDto {
  @IsEnum(ShipmentStatus)
  status!: ShipmentStatus;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(maximumClpAmount)
  actualCostAmount?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  carrier?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  serviceName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  trackingNumber?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  trackingUrl?: string;
}
