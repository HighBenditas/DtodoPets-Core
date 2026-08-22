import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { maximumClpAmount } from '../../../common/money/clp';

export class CreateProductVariantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sku!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  format?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  weightGrams?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]+$/)
  @MaxLength(64)
  barcode?: string;

  @IsInt()
  @Min(0)
  @Max(maximumClpAmount)
  costAmount!: number;

  @IsInt()
  @Min(0)
  @Max(maximumClpAmount)
  priceAmount!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(maximumClpAmount)
  salePriceAmount?: number;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
