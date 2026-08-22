import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProductDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  slug?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(80)
  species?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(80)
  lifeStage?: string;

  @IsOptional()
  @IsUUID('4')
  brandId?: string | null;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string | null;

  @IsBoolean()
  @ValidateIf((_object, value) => value !== undefined)
  active?: boolean;
}
