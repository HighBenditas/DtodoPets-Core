import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../../auth/permissions';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductImagesDto } from './dto/update-product-images.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
@RequirePermissions(PERMISSIONS.productsRead)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: ProductQueryDto,
  ) {
    return this.productsService.findAll(principal.organizationId, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.productsService.findOne(principal.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.productsCreate)
  create(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(principal.organizationId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.productsUpdate)
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(principal.organizationId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.productsDelete)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    await this.productsService.deactivate(principal.organizationId, id);
  }

  @Post(':id/variants')
  @RequirePermissions(PERMISSIONS.productsCreate)
  createVariant(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() dto: CreateProductVariantDto,
  ) {
    return this.productsService.createVariant(
      principal.organizationId,
      productId,
      dto,
    );
  }

  @Patch(':id/variants/:variantId')
  @RequirePermissions(PERMISSIONS.productsUpdate)
  updateVariant(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Param('variantId', new ParseUUIDPipe({ version: '4' })) variantId: string,
    @Body() dto: UpdateProductVariantDto,
  ) {
    return this.productsService.updateVariant(
      principal.organizationId,
      productId,
      variantId,
      dto,
    );
  }

  @Put(':id/images')
  @RequirePermissions(PERMISSIONS.productsUpdate)
  replaceImages(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() dto: UpdateProductImagesDto,
  ) {
    return this.productsService.replaceImages(
      principal.organizationId,
      productId,
      dto.images,
    );
  }
}
