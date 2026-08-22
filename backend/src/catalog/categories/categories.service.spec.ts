import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: {
    $transaction: jest.Mock;
    category: {
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
      category: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(CategoriesService);
  });

  it('rejects a parent category that is outside the tenant', async () => {
    prisma.category.findFirst.mockResolvedValue(null);

    await expect(
      service.create('org-a', { name: 'Perros', parentId: 'category-b' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.category.create).not.toHaveBeenCalled();
  });

  it('prevents a category from becoming its own parent', async () => {
    prisma.category.findFirst.mockResolvedValue({
      id: 'category-a',
      parentId: null,
    });

    await expect(
      service.update('org-a', 'category-a', { parentId: 'category-a' }),
    ).rejects.toThrow('Category hierarchy would contain a cycle');
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it('detects a cycle through an existing ancestor chain', async () => {
    prisma.category.findFirst
      .mockResolvedValueOnce({ id: 'category-a', parentId: null })
      .mockResolvedValueOnce({ parentId: 'category-a' });

    await expect(
      service.update('org-a', 'category-a', { parentId: 'category-child' }),
    ).rejects.toThrow('Category hierarchy would contain a cycle');
    expect(prisma.category.update).not.toHaveBeenCalled();
  });
});
