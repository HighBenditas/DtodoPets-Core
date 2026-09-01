import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CreatePosSaleDto } from './dto/create-pos-sale.dto';
import { PosCatalogQueryDto } from './dto/pos-catalog-query.dto';
import { PosService } from './pos.service';

@Controller('pos')
@RequirePermissions(PERMISSIONS.posSell)
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Get('catalog')
  catalog(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: PosCatalogQueryDto,
  ) {
    return this.posService.catalog(principal.organizationId, query);
  }

  @Post('sales')
  sell(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: CreatePosSaleDto,
  ) {
    return this.posService.sell(principal.organizationId, principal.id, dto);
  }
}
