import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import {
  StorefrontCartItemDto,
  StorefrontCatalogQueryDto,
  StorefrontCheckoutDto,
  StorefrontPromotionCodeDto,
} from './dto/storefront.dto';
import { StorefrontService } from './storefront.service';

@Public()
@Controller('storefront/:organizationSlug/:channelKey')
export class StorefrontController {
  constructor(private readonly service: StorefrontService) {}

  @Get('catalog')
  catalog(
    @Param('organizationSlug') organizationSlug: string,
    @Param('channelKey') channelKey: string,
    @Query() query: StorefrontCatalogQueryDto,
  ) {
    return this.service.catalog(organizationSlug, channelKey, query);
  }

  @Get('catalog/:productSlug')
  product(
    @Param('organizationSlug') organizationSlug: string,
    @Param('channelKey') channelKey: string,
    @Param('productSlug') productSlug: string,
  ) {
    return this.service.product(organizationSlug, channelKey, productSlug);
  }

  @Get('promotions')
  promotions(
    @Param('organizationSlug') organizationSlug: string,
    @Param('channelKey') channelKey: string,
  ) {
    return this.service.promotions(organizationSlug, channelKey);
  }

  @Post('carts')
  createCart(
    @Param('organizationSlug') organizationSlug: string,
    @Param('channelKey') channelKey: string,
  ) {
    return this.service.createCart(organizationSlug, channelKey);
  }

  @Get('carts/:cartId')
  cart(
    @Param('organizationSlug') organizationSlug: string,
    @Param('channelKey') channelKey: string,
    @Param('cartId', new ParseUUIDPipe({ version: '4' })) cartId: string,
    @Headers('x-cart-token') cartToken: string | undefined,
  ) {
    return this.service.cart(organizationSlug, channelKey, cartId, cartToken);
  }

  @Put('carts/:cartId/items/:variantId')
  setItem(
    @Param('organizationSlug') organizationSlug: string,
    @Param('channelKey') channelKey: string,
    @Param('cartId', new ParseUUIDPipe({ version: '4' })) cartId: string,
    @Param('variantId', new ParseUUIDPipe({ version: '4' })) variantId: string,
    @Headers('x-cart-token') cartToken: string | undefined,
    @Body() dto: StorefrontCartItemDto,
  ) {
    return this.service.setItem(
      organizationSlug,
      channelKey,
      cartId,
      cartToken,
      variantId,
      dto.quantity,
    );
  }

  @Delete('carts/:cartId/items/:variantId')
  removeItem(
    @Param('organizationSlug') organizationSlug: string,
    @Param('channelKey') channelKey: string,
    @Param('cartId', new ParseUUIDPipe({ version: '4' })) cartId: string,
    @Param('variantId', new ParseUUIDPipe({ version: '4' })) variantId: string,
    @Headers('x-cart-token') cartToken: string | undefined,
  ) {
    return this.service.removeItem(
      organizationSlug,
      channelKey,
      cartId,
      cartToken,
      variantId,
    );
  }

  @Put('carts/:cartId/promotion')
  applyPromotion(
    @Param('organizationSlug') organizationSlug: string,
    @Param('channelKey') channelKey: string,
    @Param('cartId', new ParseUUIDPipe({ version: '4' })) cartId: string,
    @Headers('x-cart-token') cartToken: string | undefined,
    @Body() dto: StorefrontPromotionCodeDto,
  ) {
    return this.service.applyPromotion(
      organizationSlug,
      channelKey,
      cartId,
      cartToken,
      dto.code,
    );
  }

  @Delete('carts/:cartId/promotion')
  removePromotion(
    @Param('organizationSlug') organizationSlug: string,
    @Param('channelKey') channelKey: string,
    @Param('cartId', new ParseUUIDPipe({ version: '4' })) cartId: string,
    @Headers('x-cart-token') cartToken: string | undefined,
  ) {
    return this.service.removePromotion(
      organizationSlug,
      channelKey,
      cartId,
      cartToken,
    );
  }

  @Post('carts/:cartId/checkout')
  checkout(
    @Param('organizationSlug') organizationSlug: string,
    @Param('channelKey') channelKey: string,
    @Param('cartId', new ParseUUIDPipe({ version: '4' })) cartId: string,
    @Headers('x-cart-token') cartToken: string | undefined,
    @Body() dto: StorefrontCheckoutDto,
  ) {
    return this.service.checkout(
      organizationSlug,
      channelKey,
      cartId,
      cartToken,
      dto,
    );
  }
}
