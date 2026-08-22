import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ListQueryDto } from '../../../common/pagination/pagination-query.dto';

export class ProductQueryDto extends ListQueryDto {
  @IsOptional()
  @IsUUID('4')
  brandId?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  species?: string;
}
