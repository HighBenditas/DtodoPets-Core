import { IsInt, IsUUID, Max, Min, NotEquals } from 'class-validator';
import { InventoryMutationDto } from './inventory-mutation.dto';

export const maximumInventoryMutation = 1_000_000_000;

export class AdjustInventoryDto extends InventoryMutationDto {
  @IsUUID('4')
  warehouseId!: string;

  @IsUUID('4')
  variantId!: string;

  @IsInt()
  @Min(-maximumInventoryMutation)
  @Max(maximumInventoryMutation)
  @NotEquals(0)
  quantityDelta!: number;
}
