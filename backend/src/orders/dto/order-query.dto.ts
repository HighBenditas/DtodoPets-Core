import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { OrderStatus } from '../../generated/prisma/client';

export class OrderQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
