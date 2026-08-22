export interface AuthEnvironment {
  accessTokenTtlSeconds: number;
  jwtAccessSecret: string;
  refreshTokenTtlSeconds: number;
}

export const AUTH_ENVIRONMENT = Symbol('AUTH_ENVIRONMENT');
export const localDevelopmentJwtSecret =
  'local-development-only-secret-change-before-production';

export function readAuthEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): AuthEnvironment {
  const jwtAccessSecret =
    environment.JWT_ACCESS_SECRET ?? localDevelopmentJwtSecret;
  const accessTokenTtlSeconds = parseInteger(
    environment.JWT_ACCESS_TTL_SECONDS ?? '900',
    'JWT_ACCESS_TTL_SECONDS',
    60,
    3600,
  );
  const refreshTokenTtlDays = parseInteger(
    environment.AUTH_REFRESH_TTL_DAYS ?? '30',
    'AUTH_REFRESH_TTL_DAYS',
    1,
    365,
  );

  if (jwtAccessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must contain at least 32 characters');
  }

  if (
    environment.NODE_ENV === 'production' &&
    jwtAccessSecret === localDevelopmentJwtSecret
  ) {
    throw new Error('JWT_ACCESS_SECRET must be configured in production');
  }

  return {
    accessTokenTtlSeconds,
    jwtAccessSecret,
    refreshTokenTtlSeconds: refreshTokenTtlDays * 24 * 60 * 60,
  };
}

function parseInteger(
  rawValue: string,
  variableName: string,
  minimum: number,
  maximum: number,
) {
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${variableName} must be an integer between ${minimum} and ${maximum}`,
    );
  }

  return value;
}
