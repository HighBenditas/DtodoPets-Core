import { BadRequestException } from '@nestjs/common';
import { maximumClpAmount } from '../common/money/clp';
import { PromotionScope, PromotionType } from '../generated/prisma/client';

export interface PromotionLine {
  quantity: number;
  unitPriceAmount: number;
  variantId: string;
}

export interface PriceablePromotion {
  id: string;
  maximumDiscountAmount: { toString(): string } | null;
  minimumSubtotalAmount: { toString(): string };
  priority: number;
  scope: PromotionScope;
  type: PromotionType;
  value: number;
  variants: Array<{ variantId: string }>;
}

export interface PromotionPrice<T extends PriceablePromotion> {
  discountAmount: number;
  promotion: T | null;
}

export function subtotalOf(lines: PromotionLine[]) {
  return lines.reduce((sum, line) => {
    const amount = line.unitPriceAmount * line.quantity;
    if (
      !Number.isSafeInteger(amount) ||
      amount < 0 ||
      amount > maximumClpAmount
    ) {
      throw new BadRequestException('Cart total exceeds supported CLP range');
    }
    const next = sum + amount;
    if (!Number.isSafeInteger(next) || next > maximumClpAmount) {
      throw new BadRequestException('Cart total exceeds supported CLP range');
    }
    return next;
  }, 0);
}

export function promotionDiscount(
  promotion: PriceablePromotion,
  lines: PromotionLine[],
) {
  const subtotal = subtotalOf(lines);
  if (subtotal < Number(promotion.minimumSubtotalAmount)) return 0;
  const eligibleIds =
    promotion.scope === PromotionScope.VARIANTS
      ? new Set(promotion.variants.map(({ variantId }) => variantId))
      : null;
  const eligibleSubtotal = subtotalOf(
    eligibleIds
      ? lines.filter(({ variantId }) => eligibleIds.has(variantId))
      : lines,
  );
  if (eligibleSubtotal === 0) return 0;
  const calculated =
    promotion.type === PromotionType.PERCENTAGE
      ? Number(
          (BigInt(eligibleSubtotal) * BigInt(promotion.value)) / BigInt(100),
        )
      : Math.min(promotion.value, eligibleSubtotal);
  const capped = promotion.maximumDiscountAmount
    ? Math.min(calculated, Number(promotion.maximumDiscountAmount))
    : calculated;
  return Math.min(capped, eligibleSubtotal);
}

export function bestPromotion<T extends PriceablePromotion>(
  promotions: T[],
  lines: PromotionLine[],
): PromotionPrice<T> {
  let result: PromotionPrice<T> = { discountAmount: 0, promotion: null };
  for (const promotion of promotions) {
    const discountAmount = promotionDiscount(promotion, lines);
    if (
      discountAmount > result.discountAmount ||
      (discountAmount === result.discountAmount &&
        result.promotion &&
        promotion.priority > result.promotion.priority)
    ) {
      result = { discountAmount, promotion };
    }
  }
  return result;
}
