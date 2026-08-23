import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  Prisma,
  PromotionScope,
  PromotionType,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from './promotions.service';

describe('PromotionsService', () => {
  let service: PromotionsService;
  let prisma: {
    $transaction: jest.Mock;
    productVariant: { count: jest.Mock };
    promotion: {
      count: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    salesChannel: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      productVariant: { count: jest.fn() },
      promotion: {
        count: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      salesChannel: { findFirst: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        PromotionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(PromotionsService);
  });

  it('does not expose a promotion from another tenant', async () => {
    prisma.promotion.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('org-a', 'promotion-b'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.promotion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'promotion-b', organizationId: 'org-a' },
      }),
    );
  });

  it('rejects a channel that is not an own storefront in the tenant', async () => {
    let query: Prisma.SalesChannelFindFirstArgs | undefined;
    prisma.salesChannel.findFirst.mockImplementation(
      (input: Prisma.SalesChannelFindFirstArgs) => {
        query = input;
        return Promise.resolve(null);
      },
    );

    await expect(
      service.create('org-a', 'user-a', {
        automatic: true,
        name: 'Oferta web',
        salesChannelId: '550e8400-e29b-41d4-a716-446655440000',
        scope: PromotionScope.ALL_CATALOG,
        startsAt: new Date().toISOString(),
        type: PromotionType.PERCENTAGE,
        value: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(query?.where).toMatchObject({ organizationId: 'org-a' });
  });

  it('scopes active coupon lookup to the tenant and storefront', async () => {
    const promotion = { id: 'promotion-a' };
    let query: Prisma.PromotionFindFirstArgs | undefined;
    prisma.promotion.findFirst.mockImplementation(
      (input: Prisma.PromotionFindFirstArgs) => {
        query = input;
        return Promise.resolve(promotion);
      },
    );

    await expect(
      service.findActiveByCode(
        'org-a',
        'channel-a',
        ' verano-10 ',
        new Date('2026-08-22T12:00:00.000Z'),
      ),
    ).resolves.toBe(promotion);
    expect(query?.where).toMatchObject({
      active: true,
      automatic: false,
      code: 'VERANO-10',
      organizationId: 'org-a',
    });
    expect(query?.where?.AND).toEqual(
      expect.arrayContaining([
        { OR: [{ salesChannelId: null }, { salesChannelId: 'channel-a' }] },
      ]),
    );
  });
});
