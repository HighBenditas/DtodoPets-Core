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
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { MovementQueryDto } from './dto/movement-query.dto';
import { ReleaseReservationDto } from './dto/release-reservation.dto';
import { ReservationQueryDto } from './dto/reservation-query.dto';
import { ReserveInventoryDto } from './dto/reserve-inventory.dto';
import { TransferInventoryDto } from './dto/transfer-inventory.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@RequirePermissions(PERMISSIONS.inventoryRead)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('balances')
  findBalances(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: InventoryQueryDto,
  ) {
    return this.inventoryService.findBalances(principal.organizationId, query);
  }

  @Get('balances/:id')
  findBalance(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.inventoryService.findBalance(principal.organizationId, id);
  }

  @Get('movements')
  findMovements(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: MovementQueryDto,
  ) {
    return this.inventoryService.findMovements(principal.organizationId, query);
  }

  @Get('reservations')
  findReservations(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: ReservationQueryDto,
  ) {
    return this.inventoryService.findReservations(
      principal.organizationId,
      query,
    );
  }

  @Post('adjustments')
  @RequirePermissions(PERMISSIONS.inventoryAdjust)
  adjust(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: AdjustInventoryDto,
  ) {
    return this.inventoryService.adjust(
      principal.organizationId,
      principal.id,
      dto,
    );
  }

  @Post('transfers')
  @RequirePermissions(PERMISSIONS.inventoryTransfer)
  transfer(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: TransferInventoryDto,
  ) {
    return this.inventoryService.transfer(
      principal.organizationId,
      principal.id,
      dto,
    );
  }

  @Post('reservations')
  @RequirePermissions(PERMISSIONS.inventoryReserve)
  reserve(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: ReserveInventoryDto,
  ) {
    return this.inventoryService.reserve(
      principal.organizationId,
      principal.id,
      dto,
    );
  }

  @Post('reservations/:id/release')
  @RequirePermissions(PERMISSIONS.inventoryReserve)
  release(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ReleaseReservationDto,
  ) {
    return this.inventoryService.release(
      principal.organizationId,
      principal.id,
      id,
      dto,
    );
  }
}
