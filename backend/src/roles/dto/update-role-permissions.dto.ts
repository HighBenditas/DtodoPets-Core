import { ArrayUnique, IsArray, IsString, Matches } from 'class-validator';

export class UpdateRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[a-z][a-z0-9._-]*$/, { each: true })
  permissionKeys!: string[];
}
