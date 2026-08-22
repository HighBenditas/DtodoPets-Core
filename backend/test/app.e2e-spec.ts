import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { AuthService } from './../src/auth/auth.service';
import type { AuthenticatedPrincipal } from './../src/auth/auth.types';
import { PrismaService } from './../src/prisma/prisma.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const principal: AuthenticatedPrincipal = {
    email: 'owner@dtodopets.local',
    firstName: 'Owner',
    id: '8a5cfb73-4b85-4d36-9f14-ecb97aa5e0f0',
    lastName: null,
    organizationId: 'ae06a28e-4829-42e8-b338-0f7dd4c2be18',
    organizationSlug: 'dtodopets',
    permissions: ['organizations.read', 'users.manage'],
    roles: ['owner'],
    sessionId: '25559660-e6ea-4ca7-a737-b119699164d4',
  };
  const authService = {
    authenticate: jest.fn(),
    bootstrap: jest.fn(),
    getProfile: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
  };
  const organization = {
    active: true,
    createdAt: new Date('2026-08-22T00:00:00.000Z'),
    id: principal.organizationId,
    name: 'DTodoPets',
    slug: 'dtodopets',
    updatedAt: new Date('2026-08-22T00:00:00.000Z'),
  };

  beforeEach(async () => {
    authService.authenticate.mockReset().mockResolvedValue(principal);
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
          findMany: jest.fn().mockResolvedValue([organization]),
        },
      })
      .overrideProvider(AuthService)
      .useValue(authService)
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

  it('rejects unknown bootstrap fields', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/bootstrap')
      .send({
        email: 'admin@dtodopets.local',
        firstName: 'Admin',
        organizationName: 'DTodoPets',
        password: 'Development-password-123!',
        unexpected: true,
      })
      .expect(400)
      .expect((response) => {
        expect(response.body).toMatchObject({
          code: 'VALIDATION_ERROR',
          statusCode: 400,
        });
      });
  });

  it('protects organization endpoints', () => {
    return request(app.getHttpServer())
      .get('/api/v1/organizations')
      .expect(401);
  });

  it('uses the authenticated tenant for organization endpoints', () => {
    return request(app.getHttpServer())
      .get('/api/v1/organizations')
      .set('authorization', 'Bearer valid-token')
      .expect(200)
      .expect((response) => {
        const body: unknown = response.body;
        expect(body).toMatchObject([
          { id: principal.organizationId, slug: 'dtodopets' },
        ]);
      });
  });

  it('rejects an authenticated user without the required permission', () => {
    authService.authenticate.mockResolvedValueOnce({
      ...principal,
      permissions: [],
    });
    return request(app.getHttpServer())
      .get('/api/v1/users')
      .set('authorization', 'Bearer valid-token')
      .expect(403);
  });

  afterEach(async () => {
    await app.close();
  });
});
