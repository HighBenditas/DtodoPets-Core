import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { maximumInventoryMutation } from './adjust-inventory.dto';
import { InventoryMutationDto } from './inventory-mutation.dto';

export class TransferInventoryDto extends InventoryMutationDto {
  @IsUUID('4')
  sourceWarehouseId!: string;

  @IsUUID('4')
  destinationWarehouseId!: string;

  @IsUUID('4')
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(maximumInventoryMutation)
  quantity!: number;
}
