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
  ValidateIf,
} from 'class-validator';
import { maximumClpAmount } from '../../../common/money/clp';

export class UpdateProductVariantDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sku?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(120)
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(120)
  format?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  weightGrams?: number | null;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]+$/)
  @MaxLength(64)
  barcode?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(maximumClpAmount)
  costAmount?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(maximumClpAmount)
  priceAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(maximumClpAmount)
  salePriceAmount?: number | null;

  @IsBoolean()
  @ValidateIf((_object, value) => value !== undefined)
  active?: boolean;
}
