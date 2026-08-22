import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../../auth/permissions';
import { ListQueryDto } from '../../common/pagination/pagination-query.dto';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Controller('brands')
@RequirePermissions(PERMISSIONS.productsRead)
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  findAll(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: ListQueryDto,
  ) {
    return this.brandsService.findAll(principal.organizationId, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.brandsService.findOne(principal.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.productsCreate)
  create(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: CreateBrandDto,
  ) {
    return this.brandsService.create(principal.organizationId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.productsUpdate)
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateBrandDto,
  ) {
    return this.brandsService.update(principal.organizationId, id, dto);
  }
}
