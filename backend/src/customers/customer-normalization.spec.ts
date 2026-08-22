import { BadRequestException } from '@nestjs/common';
import {
  normalizeChileanPhone,
  normalizeChileanRut,
  normalizeCustomerEmail,
} from './customer-normalization';

describe('customer normalization', () => {
  it('normalizes email consistently', () => {
    expect(normalizeCustomerEmail('  CLIENTE@Example.COM ')).toBe(
      'cliente@example.com',
    );
  });

  it.each([
    ['+56 9 1234 5678', '+56912345678'],
    ['9 1234-5678', '+56912345678'],
    ['02 2345 6789', '+56223456789'],
  ])('normalizes Chilean phone %s', (input, expected) => {
    expect(normalizeChileanPhone(input)).toBe(expected);
  });

  it('rejects a phone outside the Chilean numbering plan', () => {
    expect(() => normalizeChileanPhone('+1 202 555 0100')).toThrow(
      BadRequestException,
    );
  });

  it('normalizes and validates a Chilean RUT', () => {
    expect(normalizeChileanRut('12.345.678-5')).toBe('12345678-5');
  });

  it('rejects an invalid RUT verifier', () => {
    expect(() => normalizeChileanRut('12.345.678-9')).toThrow(
      BadRequestException,
    );
  });
});
