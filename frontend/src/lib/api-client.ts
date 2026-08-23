import { environment } from '../config/environment';

interface ErrorPayload {
  correlationId?: unknown;
  message?: unknown;
}

interface RequestOptions extends RequestInit {
  accessToken?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  path: string,
  { accessToken, ...options }: RequestOptions = {},
) {
  const headers = new Headers(options.headers);
  headers.set('accept', 'application/json');
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  if (options.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${environment.apiBaseUrl}${normalizedPath(path)}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(
      0,
      'No pudimos conectar con DTodoPets. Revisa que la API esté disponible.',
    );
  }

  const payload = await responsePayload(response);
  if (!response.ok) {
    const error = isRecord(payload) ? (payload as ErrorPayload) : undefined;
    throw new ApiError(
      response.status,
      typeof error?.message === 'string'
        ? error.message
        : `La API respondió con estado ${response.status}.`,
      typeof error?.correlationId === 'string'
        ? error.correlationId
        : response.headers.get('x-correlation-id') || undefined,
    );
  }
  return payload as T;
}

function normalizedPath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

async function responsePayload(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return undefined;
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new ApiError(
      response.status,
      'La API devolvió una respuesta que no pudimos interpretar.',
      response.headers.get('x-correlation-id') || undefined,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

