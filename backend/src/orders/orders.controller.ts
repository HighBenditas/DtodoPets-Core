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
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { TransitionOrderDto } from './dto/transition-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@RequirePermissions(PERMISSIONS.ordersRead)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: OrderQueryDto,
  ) {
    return this.ordersService.findAll(principal.organizationId, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.ordersService.findOne(principal.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ordersCreate)
  create(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.create(
      principal.organizationId,
      principal.id,
      dto,
    );
  }

  @Post(':id/confirm')
  @RequirePermissions(PERMISSIONS.ordersUpdate)
  confirm(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: TransitionOrderDto,
  ) {
    return this.ordersService.confirm(
      principal.organizationId,
      principal.id,
      id,
      dto,
    );
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.ordersUpdate)
  cancel(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: TransitionOrderDto,
  ) {
    return this.ordersService.cancel(
      principal.organizationId,
      principal.id,
      id,
      dto,
    );
  }
}
