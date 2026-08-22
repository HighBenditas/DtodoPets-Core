import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { maximumClpAmount } from '../../common/money/clp';

export class CreateOrderItemDto {
  @IsUUID('4')
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(maximumClpAmount)
  discountAmount?: number;
}
