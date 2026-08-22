import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
        organization: {
          create: jest.fn(),
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, {
      corsOrigins: [],
      nodeEnv: 'test',
      port: 3000,
    });
    await app.init();
  });

  it('/api/v1 (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect({ name: 'DTodoPets Core API', version: 'v1' });
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ database: 'up', status: 'ok' });
        expect(response.headers['x-correlation-id']).toBeDefined();
      });
  });

  it('rejects unknown organization fields', () => {
    return request(app.getHttpServer())
      .post('/api/v1/organizations')
      .send({ name: 'DTodoPets', unexpected: true })
      .expect(400)
      .expect((response) => {
        expect(response.body).toMatchObject({
          code: 'VALIDATION_ERROR',
          statusCode: 400,
        });
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
