import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReleaseReservationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
