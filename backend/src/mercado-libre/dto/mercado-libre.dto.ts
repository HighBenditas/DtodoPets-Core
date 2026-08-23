import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { maximumClpAmount } from '../../common/money/clp';

export class MercadoLibreListingDto {
  @IsUUID('4')
  variantId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  externalItemId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalVariationId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(maximumClpAmount)
  listingPriceAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(maximumClpAmount)
  feeAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  availableQuantity?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class MercadoLibreImportItemDto {
  @IsString()
  @IsNotEmpty()
  externalItemId!: string;

  @IsOptional()
  @IsString()
  externalVariationId?: string;

  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(maximumClpAmount)
  discountAmount?: number;
}

export class MercadoLibreImportOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  externalOrderId!: string;

  @IsUUID('4')
  customerId!: string;

  @IsUUID('4')
  customerAddressId!: string;

  @IsUUID('4')
  warehouseId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => MercadoLibreImportItemDto)
  items!: MercadoLibreImportItemDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(maximumClpAmount)
  discountAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(maximumClpAmount)
  shippingAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class MercadoLibreWebhookDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  _id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  topic!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  resource!: string;

  @IsInt()
  @Min(1)
  user_id!: number;

  @IsInt()
  @Min(1)
  application_id!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  attempts?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  received?: string;
}
