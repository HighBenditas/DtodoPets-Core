import {
  Prisma,
  PromotionScope,
  PromotionType,
} from '../generated/prisma/client';
import {
  bestPromotion,
  promotionDiscount,
  subtotalOf,
} from './promotion-pricing';

const lines = [
  { quantity: 2, unitPriceAmount: 10_000, variantId: 'variant-a' },
  { quantity: 1, unitPriceAmount: 5_000, variantId: 'variant-b' },
];

function promotion(
  overrides: Partial<Parameters<typeof promotionDiscount>[0]> = {},
) {
  return {
    id: 'promotion-a',
    maximumDiscountAmount: null,
    minimumSubtotalAmount: new Prisma.Decimal(0),
    priority: 0,
    scope: PromotionScope.ALL_CATALOG,
    type: PromotionType.PERCENTAGE,
    value: 10,
    variants: [],
    ...overrides,
  };
}

describe('promotion pricing', () => {
  it('calculates percentage discounts in exact integer CLP', () => {
    expect(promotionDiscount(promotion(), lines)).toBe(2500);
  });

  it('limits a variant-scoped fixed discount to eligible subtotal', () => {
    expect(
      promotionDiscount(
        promotion({
          scope: PromotionScope.VARIANTS,
          type: PromotionType.FIXED_AMOUNT,
          value: 30_000,
          variants: [{ variantId: 'variant-b' }],
        }),
        lines,
      ),
    ).toBe(5000);
  });

  it('selects the largest automatic discount', () => {
    const result = bestPromotion(
      [promotion(), promotion({ id: 'promotion-b', value: 20 })],
      lines,
    );
    expect(result.discountAmount).toBe(5000);
    expect(result.promotion?.id).toBe('promotion-b');
  });

  it('keeps percentage arithmetic exact near the maximum CLP amount', () => {
    const maximum = 99_999_999_999_999;
    expect(
      promotionDiscount(promotion({ value: 99 }), [
        { quantity: 1, unitPriceAmount: maximum, variantId: 'variant-a' },
      ]),
    ).toBe(Number((BigInt(maximum) * BigInt(99)) / BigInt(100)));
  });

  it('rejects subtotals outside the supported DECIMAL(14,0) range', () => {
    expect(() =>
      subtotalOf([
        {
          quantity: 2,
          unitPriceAmount: 99_999_999_999_999,
          variantId: 'variant-a',
        },
      ]),
    ).toThrow('Cart total exceeds supported CLP range');
  });
});
