import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  catchError,
  concatMap,
  from,
  map,
  Observable,
  of,
  switchMap,
  throwError,
} from 'rxjs';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { AuditOutcome } from '../generated/prisma/client';
import { AuditService } from './audit.service';

const auditedMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

type AuditedRequest = Omit<AuthenticatedRequest, 'route'> & {
  route?: { path?: unknown };
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const principal = request.user;
    const method = request.method.toUpperCase();
    if (!principal || !auditedMethods.has(method)) return next.handle();

    const startedAtMs = Date.now();
    const action = `${context.getClass().name}.${context.getHandler().name}`;
    const route = routeOf(request, action);
    const correlationId = correlationIdOf(request);
    const resourceType = resourceTypeOf(context.getClass().name);

    return from(
      this.audit.start(principal, {
        action,
        correlationId,
        ipAddress: ipAddressOf(request),
        method,
        resourceType,
        route,
      }),
    ).pipe(
      switchMap((auditLog) =>
        next.handle().pipe(
          concatMap((value: unknown) =>
            from(
              this.audit.finish(
                principal.organizationId,
                auditLog.id,
                auditLog.startedAt,
                {
                  durationMs: Date.now() - startedAtMs,
                  httpStatus: response.statusCode,
                  outcome: AuditOutcome.SUCCEEDED,
                  resourceId: resourceIdOf(request, value),
                },
              ),
            ).pipe(
              map(() => value),
              catchError(() => {
                this.logFinalizeFailure(auditLog.id);
                return of(value);
              }),
            ),
          ),
          catchError((error: unknown) =>
            from(
              this.audit.finish(
                principal.organizationId,
                auditLog.id,
                auditLog.startedAt,
                {
                  durationMs: Date.now() - startedAtMs,
                  httpStatus: statusOf(error),
                  outcome: AuditOutcome.FAILED,
                  resourceId: resourceIdOf(request),
                },
              ),
            ).pipe(
              catchError(() => {
                this.logFinalizeFailure(auditLog.id);
                return of(undefined);
              }),
              switchMap(() => throwError(() => error)),
            ),
          ),
        ),
      ),
    );
  }

  private logFinalizeFailure(auditLogId: string) {
    this.logger.error(`Failed to finalize audit log ${auditLogId}`);
  }
}

function routeOf(request: AuditedRequest, fallback: string) {
  const route = request.route?.path;
  return typeof route === 'string' && route.trim() ? route : fallback;
}

function correlationIdOf(request: AuditedRequest) {
  const header = request.headers['x-correlation-id'];
  const value = Array.isArray(header) ? header[0] : header;
  return value?.trim() || 'unknown';
}

function ipAddressOf(request: AuditedRequest) {
  const value = request.socket.remoteAddress?.trim();
  return value && value.length <= 64 ? value : undefined;
}

function resourceTypeOf(controllerName: string) {
  return controllerName
    .replace(/Controller$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

function resourceIdOf(request: AuditedRequest, value?: unknown) {
  const returnedId = nestedId(value);
  if (returnedId) return returnedId;
  const params = Object.values(request.params).filter(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate.trim().length > 0,
  );
  return params.at(-1);
}

function nestedId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.id === 'string' && record.id.trim()) return record.id;
  for (const key of [
    'address',
    'channel',
    'integration',
    'listing',
    'order',
    'payment',
    'receipt',
    'reference',
    'refund',
    'reservation',
    'return',
    'shipment',
  ]) {
    const candidate = nestedId(record[key]);
    if (candidate) return candidate;
  }
  return undefined;
}

function statusOf(error: unknown) {
  return error instanceof HttpException ? error.getStatus() : 500;
}
