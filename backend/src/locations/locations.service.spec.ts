import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { LocationsService } from './locations.service';

describe('LocationsService', () => {
  let service: LocationsService;
  let prisma: {
    $transaction: jest.Mock;
    location: {
      count: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
      location: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        LocationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(LocationsService);
  });

  it('paginates and filters only inside the tenant', async () => {
    let findManyCall: unknown;
    prisma.location.findMany.mockImplementation((input: unknown) => {
      findManyCall = input;
      return Promise.resolve([{ id: 'location-id' }]);
    });
    prisma.location.count.mockResolvedValue(1);

    const result = await service.findAll('org-a', {
      active: true,
      limit: 10,
      page: 2,
      search: 'centro',
    });

    expect(result.meta).toEqual({ limit: 10, page: 2, pageCount: 1, total: 1 });
    expect(findManyCall).toMatchObject({
      skip: 10,
      take: 10,
      where: { active: true, organizationId: 'org-a' },
    });
  });

  it('does not return a location from another tenant', async () => {
    prisma.location.findFirst.mockResolvedValue(null);
    await expect(service.findOne('org-a', 'location-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.location.findFirst).toHaveBeenCalledWith({
      where: { id: 'location-b', organizationId: 'org-a' },
    });
  });

  it('uses the authenticated organization when creating', async () => {
    let createCall: unknown;
    prisma.location.create.mockImplementation((input: unknown) => {
      createCall = input;
      return Promise.resolve({ id: 'location-id' });
    });

    await service.create('org-a', { name: ' Central ' });
    expect(createCall).toMatchObject({
      data: { active: true, name: 'Central', organizationId: 'org-a' },
    });
  });
});
