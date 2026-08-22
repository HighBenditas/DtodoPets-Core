import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { InventoryMovementType } from '../../generated/prisma/client';

export class MovementQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  warehouseId?: string;

  @IsOptional()
  @IsUUID('4')
  variantId?: string;

  @IsOptional()
  @IsEnum(InventoryMovementType)
  type?: InventoryMovementType;

  @IsOptional()
  @IsUUID('4')
  operationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  referenceId?: string;
}
