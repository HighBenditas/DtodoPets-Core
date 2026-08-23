import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class CreateShipmentItemDto {
  @IsUUID('4')
  orderItemId!: string;

  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity!: number;
}
