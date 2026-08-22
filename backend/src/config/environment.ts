export interface AppEnvironment {
  corsOrigins: string[];
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
}

const supportedNodeEnvironments = new Set([
  'development',
  'test',
  'production',
]);

export function readAppEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): AppEnvironment {
  const nodeEnv = environment.NODE_ENV ?? 'development';

  if (!supportedNodeEnvironments.has(nodeEnv)) {
    throw new Error('NODE_ENV must be one of development, test or production');
  }

  const port = Number(environment.PORT ?? 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return {
    corsOrigins: (environment.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    nodeEnv: nodeEnv as AppEnvironment['nodeEnv'],
    port,
  };
}
