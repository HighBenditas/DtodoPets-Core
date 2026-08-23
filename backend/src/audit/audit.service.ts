import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { createPage, getPagination } from '../common/pagination/pagination';
import { AuditOutcome, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

const auditLogInclude = {
  actor: {
    select: {
      active: true,
      email: true,
      firstName: true,
      id: true,
      lastName: true,
    },
  },
} satisfies Prisma.AuditLogInclude;

export interface StartAuditInput {
  action: string;
  correlationId: string;
  ipAddress?: string;
  method: string;
  resourceType?: string;
  route: string;
}

export interface FinishAuditInput {
  durationMs: number;
  httpStatus: number;
  outcome: Exclude<AuditOutcome, 'ATTEMPTED'>;
  resourceId?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: AuditLogQueryDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && to <= from) {
      throw new BadRequestException('to must be after from');
    }
    const search = normalizedFilter(query.search);
    const where: Prisma.AuditLogWhereInput = {
      actorUserId: query.actorUserId,
      correlationId: normalizedFilter(query.correlationId),
      method: query.method,
      organizationId,
      outcome: query.outcome,
      resourceId: normalizedFilter(query.resourceId),
      resourceType: normalizedFilter(query.resourceType),
      startedAt:
        from || to
          ? {
              gte: from,
              lt: to,
            }
          : undefined,
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: 'insensitive' } },
              { route: { contains: search, mode: 'insensitive' } },
              { resourceType: { contains: search, mode: 'insensitive' } },
              { resourceId: { contains: search, mode: 'insensitive' } },
              { correlationId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.auditLog.findMany({
      where,
      include: auditLogInclude,
      ...getPagination(query),
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    });
    const total = await this.prisma.auditLog.count({ where });
    return createPage(rows, total, query);
  }

  start(principal: AuthenticatedPrincipal, input: StartAuditInput) {
    return this.prisma.auditLog.create({
      data: {
        action: input.action,
        actorUserId: principal.id,
        correlationId: input.correlationId,
        ipAddress: input.ipAddress,
        method: input.method,
        organizationId: principal.organizationId,
        resourceType: input.resourceType,
        route: input.route,
        sessionId: principal.sessionId,
      },
      select: { id: true, startedAt: true },
    });
  }

  async finish(
    organizationId: string,
    auditLogId: string,
    startedAt: Date,
    input: FinishAuditInput,
  ) {
    const completedAt = new Date(Math.max(Date.now(), startedAt.getTime()));
    const result = await this.prisma.auditLog.updateMany({
      where: {
        id: auditLogId,
        organizationId,
        outcome: AuditOutcome.ATTEMPTED,
      },
      data: {
        completedAt,
        durationMs: Math.max(0, Math.trunc(input.durationMs)),
        httpStatus: input.httpStatus,
        outcome: input.outcome,
        resourceId: input.resourceId,
      },
    });
    if (result.count !== 1) {
      throw new Error('Audit log could not be finalized');
    }
  }
}

function normalizedFilter(value: string | undefined) {
  return value?.trim() || undefined;
}
