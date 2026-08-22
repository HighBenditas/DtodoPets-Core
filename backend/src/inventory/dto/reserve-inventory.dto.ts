import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { maximumInventoryMutation } from './adjust-inventory.dto';
import { InventoryMutationDto } from './inventory-mutation.dto';

export class ReserveInventoryDto extends InventoryMutationDto {
  @IsUUID('4')
  warehouseId!: string;

  @IsUUID('4')
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(maximumInventoryMutation)
  quantity!: number;
}
