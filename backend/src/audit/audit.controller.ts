import { Controller, Get, Query } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Controller('audit-logs')
@RequirePermissions(PERMISSIONS.auditRead)
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query() query: AuditLogQueryDto,
  ) {
    return this.service.findAll(user.organizationId, query);
  }
}
