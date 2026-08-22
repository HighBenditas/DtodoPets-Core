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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('categories')
@RequirePermissions(PERMISSIONS.productsRead)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: ListQueryDto,
  ) {
    return this.categoriesService.findAll(principal.organizationId, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.categoriesService.findOne(principal.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.productsCreate)
  create(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(principal.organizationId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.productsUpdate)
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(principal.organizationId, id, dto);
  }
}
