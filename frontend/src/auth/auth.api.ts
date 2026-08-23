import { apiRequest } from '../lib/api-client';
import type {
  AuthenticatedUser,
  AuthSession,
  LoginInput,
} from './auth.types';

export async function loginRequest(input: LoginInput) {
  const payload = await apiRequest<unknown>('/auth/login', {
    body: JSON.stringify({
      email: input.email.trim(),
      organizationSlug: input.organizationSlug.trim(),
      password: input.password,
    }),
    method: 'POST',
  });
  return parseAuthSession(payload);
}

export async function refreshRequest(refreshToken: string) {
  const payload = await apiRequest<unknown>('/auth/refresh', {
    body: JSON.stringify({ refreshToken }),
    method: 'POST',
  });
  return parseAuthSession(payload);
}

export function logoutRequest(accessToken: string) {
  return apiRequest<void>('/auth/logout', { accessToken, method: 'POST' });
}

function parseAuthSession(value: unknown): AuthSession {
  if (!isRecord(value) || !isUser(value.user)) throw invalidAuthResponse();
  if (
    typeof value.accessToken !== 'string' ||
    value.accessToken.length === 0 ||
    typeof value.refreshToken !== 'string' ||
    value.refreshToken.length === 0 ||
    typeof value.expiresIn !== 'number' ||
    !Number.isFinite(value.expiresIn) ||
    value.expiresIn <= 0 ||
    value.tokenType !== 'Bearer'
  ) {
    throw invalidAuthResponse();
  }
  return {
    accessToken: value.accessToken,
    expiresIn: value.expiresIn,
    refreshToken: value.refreshToken,
    tokenType: 'Bearer',
    user: value.user,
  };
}

function isUser(value: unknown): value is AuthenticatedUser {
  if (!isRecord(value)) return false;
  return (
    typeof value.email === 'string' &&
    typeof value.firstName === 'string' &&
    typeof value.id === 'string' &&
    (typeof value.lastName === 'string' || value.lastName === null) &&
    typeof value.organizationId === 'string' &&
    typeof value.organizationSlug === 'string' &&
    isStringArray(value.permissions) &&
    isStringArray(value.roles)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidAuthResponse() {
  return new Error('La API devolvió una sesión inválida.');
}

