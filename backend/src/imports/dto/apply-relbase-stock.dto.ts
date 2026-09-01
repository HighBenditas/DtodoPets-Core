import { Transform } from 'class-transformer';
import { IsBoolean, IsUUID } from 'class-validator';

export class ApplyRelbaseStockDto {
  @IsUUID('4')
  warehouseId!: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  skipInvalidRows!: boolean;
}
