import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsString,
  Matches,
} from 'class-validator';

export class UpdateUserRolesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[a-z0-9._-]+$/, { each: true })
  roleKeys!: string[];
}
