import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { readAppEnvironment } from './config/environment';

async function bootstrap() {
  const environment = readAppEnvironment();
  const app = await NestFactory.create(AppModule);
  configureApp(app, environment);
  app.enableShutdownHooks();
  await app.listen(environment.port);
}
void bootstrap();
