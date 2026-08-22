import { validate } from 'class-validator';
import { UpdateBrandDto } from './brands/dto/update-brand.dto';
import { UpdateProductVariantDto } from './products/dto/update-product-variant.dto';
import { UpdateProductDto } from './products/dto/update-product.dto';

describe('Catalog update DTO validation', () => {
  it('rejects null for optional fields that are not nullable', async () => {
    const brandErrors = await validate(
      Object.assign(new UpdateBrandDto(), { name: null }),
    );
    const variantErrors = await validate(
      Object.assign(new UpdateProductVariantDto(), { sku: null }),
    );

    expect(brandErrors.map(({ property }) => property)).toContain('name');
    expect(variantErrors.map(({ property }) => property)).toContain('sku');
  });

  it('allows null only where it removes an optional relation or value', async () => {
    const productErrors = await validate(
      Object.assign(new UpdateProductDto(), {
        brandId: null,
        categoryId: null,
      }),
    );
    const variantErrors = await validate(
      Object.assign(new UpdateProductVariantDto(), {
        barcode: null,
        salePriceAmount: null,
        weightGrams: null,
      }),
    );

    expect(productErrors).toHaveLength(0);
    expect(variantErrors).toHaveLength(0);
  });
});
