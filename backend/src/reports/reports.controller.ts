import { Controller, Get, Query } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import {
  DailySalesQueryDto,
  ReportRangeQueryDto,
} from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@RequirePermissions(PERMISSIONS.reportsRead)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  overview(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: ReportRangeQueryDto,
  ) {
    return this.reports.overview(principal.organizationId, query);
  }

  @Get('daily-sales')
  dailySales(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: DailySalesQueryDto,
  ) {
    return this.reports.dailySales(principal.organizationId, query);
  }
}
