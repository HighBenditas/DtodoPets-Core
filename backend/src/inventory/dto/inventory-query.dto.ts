import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';

export class InventoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  warehouseId?: string;

  @IsOptional()
  @IsUUID('4')
  variantId?: string;

  @IsOptional()
  @IsUUID('4')
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
