import { Type } from 'class-transformer';
import {
  IsEmail,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';

export class StorefrontCatalogQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  species?: string;
}

export class StorefrontCartItemDto {
  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity!: number;
}

export class StorefrontPromotionCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  code!: string;
}

export class StorefrontCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}

export class StorefrontAddressDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  addressLine1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  addressLine2?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  commune!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  region!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;
}

export class StorefrontCheckoutDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => StorefrontCustomerDto)
  customer!: StorefrontCustomerDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => StorefrontAddressDto)
  shippingAddress!: StorefrontAddressDto;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
