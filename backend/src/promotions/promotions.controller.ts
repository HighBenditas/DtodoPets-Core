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
  CreatePromotionDto,
  PromotionQueryDto,
  UpdatePromotionDto,
} from './dto/promotion.dto';
import { PromotionsService } from './promotions.service';

@Controller('promotions')
@RequirePermissions(PERMISSIONS.promotionsRead)
export class PromotionsController {
  constructor(private readonly service: PromotionsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query() query: PromotionQueryDto,
  ) {
    return this.service.findAll(user.organizationId, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.findOne(user.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.promotionsManage)
  create(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: CreatePromotionDto,
  ) {
    return this.service.create(user.organizationId, user.id, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.promotionsManage)
  update(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePromotionDto,
  ) {
    return this.service.update(user.organizationId, id, dto);
  }
}
