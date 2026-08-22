import { readAppEnvironment } from './environment';

describe('readAppEnvironment', () => {
  it('uses secure defaults', () => {
    expect(readAppEnvironment({})).toEqual({
      corsOrigins: [],
      nodeEnv: 'development',
      port: 3000,
    });
  });

  it('normalizes configured CORS origins', () => {
    expect(
      readAppEnvironment({
        CORS_ORIGINS: 'http://localhost:5173, https://admin.example.com ',
        NODE_ENV: 'production',
        PORT: '8080',
      }),
    ).toEqual({
      corsOrigins: ['http://localhost:5173', 'https://admin.example.com'],
      nodeEnv: 'production',
      port: 8080,
    });
  });

  it('rejects invalid ports', () => {
    expect(() => readAppEnvironment({ PORT: '70000' })).toThrow(
      'PORT must be an integer between 1 and 65535',
    );
  });
});
