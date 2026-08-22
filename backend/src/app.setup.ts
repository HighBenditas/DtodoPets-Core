import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/http/global-exception.filter';
import { correlationIdMiddleware } from './common/http/correlation-id.middleware';
import { AppEnvironment } from './config/environment';

export function configureApp(
  app: INestApplication,
  environment: AppEnvironment,
) {
  app.use(helmet());
  app.use(correlationIdMiddleware);
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  if (environment.corsOrigins.length > 0) {
    app.enableCors({
      credentials: true,
      origin: environment.corsOrigins,
    });
  }
}
