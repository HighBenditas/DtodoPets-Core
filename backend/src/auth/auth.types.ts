import { Request } from 'express';

export interface AuthenticatedPrincipal {
  email: string;
  firstName: string;
  id: string;
  lastName: string | null;
  organizationId: string;
  organizationSlug: string;
  permissions: string[];
  roles: string[];
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedPrincipal;
}

export interface AccessTokenPayload {
  organizationId: string;
  sessionId: string;
  sub: string;
  type: 'access';
}
