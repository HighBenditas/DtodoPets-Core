import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

export const maximumClpAmount = 99_999_999_999_999;

export function toClpDecimal(amount: number) {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    amount > maximumClpAmount
  ) {
    throw new BadRequestException('CLP amount is invalid');
  }
  return new Prisma.Decimal(amount);
}

export function assertValidSalePrice(
  priceAmount: number,
  salePriceAmount: number | undefined | null,
) {
  if (salePriceAmount !== undefined && salePriceAmount !== null) {
    toClpDecimal(salePriceAmount);
    if (salePriceAmount > priceAmount) {
      throw new BadRequestException(
        'salePriceAmount cannot exceed priceAmount',
      );
    }
  }
}
