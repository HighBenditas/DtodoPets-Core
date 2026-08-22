import { localDevelopmentJwtSecret, readAuthEnvironment } from './auth.config';

describe('readAuthEnvironment', () => {
  it('provides development defaults', () => {
    expect(readAuthEnvironment({})).toEqual({
      accessTokenTtlSeconds: 900,
      jwtAccessSecret: localDevelopmentJwtSecret,
      refreshTokenTtlSeconds: 30 * 24 * 60 * 60,
    });
  });

  it('requires an explicit production secret', () => {
    expect(() => readAuthEnvironment({ NODE_ENV: 'production' })).toThrow(
      'JWT_ACCESS_SECRET must be configured in production',
    );
  });

  it('rejects weak secrets', () => {
    expect(() =>
      readAuthEnvironment({ JWT_ACCESS_SECRET: 'too-short' }),
    ).toThrow('JWT_ACCESS_SECRET must contain at least 32 characters');
  });
});
