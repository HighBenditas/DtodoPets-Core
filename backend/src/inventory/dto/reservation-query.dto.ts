import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { InventoryReservationStatus } from '../../generated/prisma/client';

export class ReservationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  warehouseId?: string;

  @IsOptional()
  @IsUUID('4')
  variantId?: string;

  @IsOptional()
  @IsEnum(InventoryReservationStatus)
  status?: InventoryReservationStatus;
}
