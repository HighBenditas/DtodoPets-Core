import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { ShipmentStatus, ShipmentType } from '../../generated/prisma/client';

export class ShipmentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  orderId?: string;

  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @IsOptional()
  @IsEnum(ShipmentType)
  type?: ShipmentType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
