import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsUUID('4')
  parentId?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
