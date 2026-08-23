import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { maximumClpAmount } from '../../common/money/clp';
import { ShipmentType } from '../../generated/prisma/client';
import { CreateShipmentItemDto } from './create-shipment-item.dto';

export class CreateShipmentDto {
  @IsUUID('4')
  orderId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateShipmentItemDto)
  items!: CreateShipmentItemDto[];

  @IsEnum(ShipmentType)
  type!: ShipmentType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(maximumClpAmount)
  customerChargeAmount?: number;

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

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  idempotencyKey!: string;
}
