import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ExceptionBody {
  code?: unknown;
  error?: unknown;
  message?: unknown;
}

const internalServerErrorStatus = 500;

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionBody = getExceptionBody(exception);
    const message = getSafeMessage(exceptionBody, status);
    const correlationId = getCorrelationId(request);

    if (status >= internalServerErrorStatus) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `${request.method} ${request.originalUrl} [${correlationId}]`,
        stack,
      );
    }

    response.status(status).json({
      code: getErrorCode(exceptionBody, status),
      correlationId,
      message,
      path: request.originalUrl,
      statusCode: status,
      timestamp: new Date().toISOString(),
    });
  }
}

function getExceptionBody(exception: unknown): ExceptionBody | undefined {
  if (!(exception instanceof HttpException)) {
    return undefined;
  }

  const response = exception.getResponse();
  return typeof response === 'object' ? response : undefined;
}

function getSafeMessage(
  exceptionBody: ExceptionBody | undefined,
  status: number,
) {
  if (typeof exceptionBody?.message === 'string') {
    return exceptionBody.message;
  }

  if (
    Array.isArray(exceptionBody?.message) &&
    exceptionBody.message.every((item) => typeof item === 'string')
  ) {
    return exceptionBody.message;
  }

  return status >= internalServerErrorStatus
    ? 'Internal server error'
    : 'Request failed';
}

function getErrorCode(
  exceptionBody: ExceptionBody | undefined,
  status: number,
) {
  if (typeof exceptionBody?.code === 'string') {
    return exceptionBody.code;
  }

  if (Array.isArray(exceptionBody?.message)) {
    return 'VALIDATION_ERROR';
  }

  if (typeof exceptionBody?.error === 'string') {
    return exceptionBody.error.toUpperCase().replace(/\s+/g, '_');
  }

  return status === internalServerErrorStatus
    ? 'INTERNAL_SERVER_ERROR'
    : `HTTP_${status}`;
}

function getCorrelationId(request: Request) {
  const header = request.headers['x-correlation-id'];
  return (Array.isArray(header) ? header[0] : header) ?? 'unknown';
}
