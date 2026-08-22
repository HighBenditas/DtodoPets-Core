import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export abstract class InventoryMutationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  referenceType?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  referenceId?: string;
}
