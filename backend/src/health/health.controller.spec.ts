import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const queryRaw = jest.fn();
  let controller: HealthController;

  beforeEach(async () => {
    queryRaw.mockReset();
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
      ],
    }).compile();
    controller = module.get(HealthController);
  });

  it('reports a healthy database', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    await expect(controller.check()).resolves.toMatchObject({
      database: 'up',
      status: 'ok',
    });
  });

  it('does not expose database errors', async () => {
    queryRaw.mockRejectedValue(new Error('connection details'));
    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
