import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateCategoryDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsUUID('4')
  parentId?: string | null;

  @IsBoolean()
  @ValidateIf((_object, value) => value !== undefined)
  active?: boolean;
}
