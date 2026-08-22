import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { WarehousesService } from './warehouses.service';

describe('WarehousesService', () => {
  let service: WarehousesService;
  let prisma: {
    location: { findFirst: jest.Mock };
    warehouse: {
      create: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      location: { findFirst: jest.fn() },
      warehouse: { create: jest.fn(), findFirst: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        WarehousesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(WarehousesService);
  });

  it('rejects a location outside the authenticated organization', async () => {
    prisma.location.findFirst.mockResolvedValue(null);
    await expect(
      service.create('org-a', {
        locationId: 'location-from-org-b',
        name: 'Warehouse',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.warehouse.create).not.toHaveBeenCalled();
  });

  it('creates a warehouse with tenant and validated location', async () => {
    let createCall: unknown;
    prisma.location.findFirst.mockResolvedValue({ id: 'location-a' });
    prisma.warehouse.create.mockImplementation((input: unknown) => {
      createCall = input;
      return Promise.resolve({ id: 'warehouse-id' });
    });

    await service.create('org-a', {
      locationId: 'location-a',
      name: ' Main ',
    });
    expect(createCall).toMatchObject({
      data: {
        active: true,
        locationId: 'location-a',
        name: 'Main',
        organizationId: 'org-a',
      },
    });
  });

  it('does not return another tenant warehouse', async () => {
    prisma.warehouse.findFirst.mockResolvedValue(null);
    await expect(
      service.findOne('org-a', 'warehouse-b'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
