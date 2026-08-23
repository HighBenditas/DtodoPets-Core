import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { PERMISSIONS } from '../auth/permissions';
import {
  MercadoLibreImportOrderDto,
  MercadoLibreListingDto,
  MercadoLibreWebhookDto,
} from './dto/mercado-libre.dto';
import { MercadoLibreService } from './mercado-libre.service';

@Controller('mercado-libre')
@RequirePermissions(PERMISSIONS.integrationsManage)
export class MercadoLibreController {
  constructor(private readonly service: MercadoLibreService) {}

  @Get('integrations/:integrationId/listings')
  findListings(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('integrationId', new ParseUUIDPipe({ version: '4' }))
    integrationId: string,
  ) {
    return this.service.findListings(user.organizationId, integrationId);
  }

  @Post('integrations/:integrationId/listings')
  upsertListing(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('integrationId', new ParseUUIDPipe({ version: '4' }))
    integrationId: string,
    @Body() dto: MercadoLibreListingDto,
  ) {
    return this.service.upsertListing(user.organizationId, integrationId, dto);
  }

  @Post('integrations/:integrationId/orders/import')
  importOrder(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('integrationId', new ParseUUIDPipe({ version: '4' }))
    integrationId: string,
    @Body() dto: MercadoLibreImportOrderDto,
  ) {
    return this.service.importOrder(
      user.organizationId,
      user.id,
      integrationId,
      dto,
    );
  }

  @Post('webhooks/:integrationId')
  @Public()
  @HttpCode(HttpStatus.OK)
  receiveWebhook(
    @Param('integrationId', new ParseUUIDPipe({ version: '4' }))
    integrationId: string,
    @Req() request: Request,
    @Body() dto: MercadoLibreWebhookDto,
  ) {
    return this.service.receiveWebhook(integrationId, request.ip, dto);
  }
}
