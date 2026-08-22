import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { maximumClpAmount } from '../../common/money/clp';
import { CreateOrderItemDto } from './create-order-item.dto';

export class CreateOrderDto {
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
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

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
