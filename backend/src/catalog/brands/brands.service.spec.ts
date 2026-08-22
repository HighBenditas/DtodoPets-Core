import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { BrandsService } from './brands.service';

describe('BrandsService', () => {
  let service: BrandsService;
  let prisma: {
    $transaction: jest.Mock;
    brand: {
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
      brand: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [BrandsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(BrandsService);
  });

  it('normalizes the slug and binds new brands to the authenticated tenant', async () => {
    prisma.brand.create.mockResolvedValue({ id: 'brand-id' });

    await service.create('org-a', { name: '  Acana Chile  ' });

    expect(prisma.brand.create).toHaveBeenCalledWith({
      data: {
        active: true,
        name: 'Acana Chile',
        organizationId: 'org-a',
        slug: 'acana-chile',
      },
    });
  });

  it('does not expose a brand from another tenant', async () => {
    prisma.brand.findFirst.mockResolvedValue(null);

    await expect(service.findOne('org-a', 'brand-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.brand.findFirst).toHaveBeenCalledWith({
      where: { id: 'brand-b', organizationId: 'org-a' },
    });
  });
});
