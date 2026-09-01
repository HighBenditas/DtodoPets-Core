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
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { maximumClpAmount } from '../../common/money/clp';
import { PaymentMethod } from '../../generated/prisma/client';

export class PosSaleItemDto {
  @IsUUID('4')
  variantId!: string;

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

export class PosSalePaymentDto {
  @IsInt()
  @Min(1)
  @Max(maximumClpAmount)
  amount!: number;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  provider!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  externalReference?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(maximumClpAmount)
  tenderedAmount?: number;
}

export class CreatePosSaleDto {
  @IsUUID('4')
  warehouseId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PosSaleItemDto)
  items!: PosSaleItemDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PosSalePaymentDto)
  payments!: PosSalePaymentDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(maximumClpAmount)
  discountAmount?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
