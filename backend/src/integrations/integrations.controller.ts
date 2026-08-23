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
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import {
  CreateExternalReferenceDto,
  CreateIntegrationDto,
  CreateSalesChannelDto,
  IntegrationQueryDto,
  ReceiveWebhookDto,
  UpdateIntegrationDto,
  UpdateSalesChannelDto,
} from './dto/integration.dto';
import { IntegrationsService } from './integrations.service';

@Controller()
@RequirePermissions(PERMISSIONS.integrationsManage)
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Get('sales-channels')
  findChannels(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query() query: IntegrationQueryDto,
  ) {
    return this.service.findChannels(user.organizationId, query);
  }

  @Post('sales-channels')
  createChannel(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: CreateSalesChannelDto,
  ) {
    return this.service.createChannel(user.organizationId, user.id, dto);
  }

  @Patch('sales-channels/:id')
  updateChannel(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateSalesChannelDto,
  ) {
    return this.service.updateChannel(user.organizationId, user.id, id, dto);
  }

  @Get('integrations')
  findIntegrations(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query() query: IntegrationQueryDto,
  ) {
    return this.service.findIntegrations(user.organizationId, query);
  }

  @Get('integrations/events')
  findEvents(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.service.findEvents(user.organizationId);
  }

  @Get('integrations/:id')
  findIntegration(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.findIntegration(user.organizationId, id);
  }

  @Post('integrations')
  createIntegration(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: CreateIntegrationDto,
  ) {
    return this.service.createIntegration(user.organizationId, user.id, dto);
  }

  @Patch('integrations/:id')
  updateIntegration(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateIntegrationDto,
  ) {
    return this.service.updateIntegration(
      user.organizationId,
      user.id,
      id,
      dto,
    );
  }

  @Post('integrations/:id/external-references')
  createReference(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateExternalReferenceDto,
  ) {
    return this.service.createExternalReference(
      user.organizationId,
      user.id,
      id,
      dto,
    );
  }

  @Post('integrations/:id/webhook-receipts')
  receiveWebhook(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ReceiveWebhookDto,
  ) {
    return this.service.receiveWebhook(user.organizationId, id, dto);
  }
}
