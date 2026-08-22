import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

const correlationIdPattern = /^[a-zA-Z0-9._:-]{1,128}$/;

export function correlationIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const header = request.headers['x-correlation-id'];
  const candidate = Array.isArray(header) ? header[0] : header;
  const correlationId =
    candidate && correlationIdPattern.test(candidate)
      ? candidate
      : randomUUID();

  request.headers['x-correlation-id'] = correlationId;
  response.setHeader('x-correlation-id', correlationId);
  next();
}
