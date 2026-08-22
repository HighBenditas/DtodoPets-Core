import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TransitionOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
