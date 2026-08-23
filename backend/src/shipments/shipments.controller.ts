import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ShipmentQueryDto } from './dto/shipment-query.dto';
import { TransitionShipmentDto } from './dto/transition-shipment.dto';
import { ShipmentsService } from './shipments.service';

@Controller('shipments')
@RequirePermissions(PERMISSIONS.shipmentsRead)
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get()
  findAll(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: ShipmentQueryDto,
  ) {
    return this.shipmentsService.findAll(principal.organizationId, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.shipmentsService.findOne(principal.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.shipmentsCreate)
  create(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: CreateShipmentDto,
  ) {
    return this.shipmentsService.create(
      principal.organizationId,
      principal.id,
      dto,
    );
  }

  @Post(':id/transitions')
  @RequirePermissions(PERMISSIONS.shipmentsUpdate)
  transition(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: TransitionShipmentDto,
  ) {
    return this.shipmentsService.transition(
      principal.organizationId,
      principal.id,
      id,
      dto,
    );
  }
}
