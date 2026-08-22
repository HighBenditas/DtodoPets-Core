import { BadRequestException } from '@nestjs/common';
import { normalizeEmail } from '../common/text/normalization';

export function normalizeCustomerEmail(value: string) {
  return normalizeEmail(value);
}

export function normalizeChileanPhone(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 9) digits = `56${digits}`;
  if (!/^56[2-9]\d{8}$/.test(digits)) {
    throw new BadRequestException('phone is invalid for Chile');
  }
  return `+${digits}`;
}

export function normalizeChileanRut(value: string) {
  const compact = value.toUpperCase().replace(/[^0-9K]/g, '');
  const body = compact.slice(0, -1);
  const verifier = compact.slice(-1);
  if (!/^\d{7,8}$/.test(body) || !/^[0-9K]$/.test(verifier)) {
    throw new BadRequestException('rut is invalid');
  }

  let sum = 0;
  let multiplier = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const result = 11 - (sum % 11);
  const expected = result === 11 ? '0' : result === 10 ? 'K' : String(result);
  if (verifier !== expected) throw new BadRequestException('rut is invalid');
  return `${body}-${verifier}`;
}
