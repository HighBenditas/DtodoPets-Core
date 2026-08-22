import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  normalizeEmail,
  normalizeSlug,
} from '../src/common/text/normalization';
import { PrismaClient } from '../src/generated/prisma/client';
import { PasswordService } from '../src/auth/password.service';
import { provisionDefaultRbac } from '../src/auth/permissions';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the database');
}

if (process.env.NODE_ENV === 'production') {
  throw new Error('Development seed cannot run with NODE_ENV=production');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const passwordService = new PasswordService();

async function main() {
  const organizationName = process.env.SEED_ORGANIZATION_NAME ?? 'DTodoPets';
  const organizationSlug = normalizeSlug(
    process.env.SEED_ORGANIZATION_SLUG ?? organizationName,
  );
  const email = normalizeEmail(
    process.env.SEED_ADMIN_EMAIL ?? 'admin@dtodopets.local',
  );
  const password =
    process.env.SEED_ADMIN_PASSWORD ?? 'Change-this-development-password-123!';

  if (!organizationSlug || password.length < 12) {
    throw new Error('Seed organization slug or admin password is invalid');
  }

  const passwordHash = await passwordService.hash(password);
  const result = await prisma.$transaction(async (transaction) => {
    const organization = await transaction.organization.upsert({
      where: { slug: organizationSlug },
      create: { name: organizationName, slug: organizationSlug },
      update: {},
    });
    const roles = await provisionDefaultRbac(transaction, organization.id);
    const ownerRoleId = roles.get('owner');

    if (!ownerRoleId) {
      throw new Error('Owner role was not provisioned');
    }

    let user = await transaction.user.findUnique({
      where: {
        organizationId_email: { email, organizationId: organization.id },
      },
    });

    if (!user) {
      user = await transaction.user.create({
        data: {
          email,
          firstName: process.env.SEED_ADMIN_FIRST_NAME ?? 'Admin',
          lastName: process.env.SEED_ADMIN_LAST_NAME ?? 'DTodoPets',
          organizationId: organization.id,
          passwordHash,
        },
      });
    }

    await transaction.userRole.upsert({
      where: { userId_roleId: { roleId: ownerRoleId, userId: user.id } },
      create: { roleId: ownerRoleId, userId: user.id },
      update: {},
    });

    const location = await transaction.location.upsert({
      where: {
        organizationId_name: {
          name: 'Sucursal Desarrollo',
          organizationId: organization.id,
        },
      },
      create: {
        city: 'Santiago',
        commune: 'Santiago',
        name: 'Sucursal Desarrollo',
        organizationId: organization.id,
        region: 'Región Metropolitana',
      },
      update: {},
    });

    await transaction.warehouse.upsert({
      where: {
        organizationId_name: {
          name: 'Bodega Desarrollo',
          organizationId: organization.id,
        },
      },
      create: {
        locationId: location.id,
        name: 'Bodega Desarrollo',
        organizationId: organization.id,
      },
      update: { locationId: location.id },
    });

    const brand = await transaction.brand.upsert({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: 'dtodopets-seleccion',
        },
      },
      create: {
        name: 'DTodoPets Selección',
        organizationId: organization.id,
        slug: 'dtodopets-seleccion',
      },
      update: { active: true, name: 'DTodoPets Selección' },
    });

    const category = await transaction.category.upsert({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: 'alimento-para-perros',
        },
      },
      create: {
        name: 'Alimento para perros',
        organizationId: organization.id,
        slug: 'alimento-para-perros',
      },
      update: { active: true, name: 'Alimento para perros' },
    });

    const product = await transaction.product.upsert({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: 'alimento-adulto-pollo-arroz',
        },
      },
      create: {
        brandId: brand.id,
        categoryId: category.id,
        description: 'Producto de demostración para desarrollo local.',
        lifeStage: 'Adulto',
        name: 'Alimento Adulto Pollo y Arroz',
        organizationId: organization.id,
        slug: 'alimento-adulto-pollo-arroz',
        species: 'Perro',
      },
      update: {
        active: true,
        brandId: brand.id,
        categoryId: category.id,
      },
    });

    await transaction.productVariant.upsert({
      where: {
        organizationId_sku: {
          organizationId: organization.id,
          sku: 'DTP-ADULTO-3KG',
        },
      },
      create: {
        costAmount: 9_500,
        format: 'Bolsa',
        name: 'Bolsa 3 kg',
        organizationId: organization.id,
        priceAmount: 14_990,
        productId: product.id,
        sku: 'DTP-ADULTO-3KG',
        weightGrams: 3_000,
      },
      update: {
        active: true,
        costAmount: 9_500,
        priceAmount: 14_990,
        productId: product.id,
      },
    });

    await transaction.productImage.upsert({
      where: {
        productId_url: {
          productId: product.id,
          url: 'https://assets.dtodopets.local/products/alimento-adulto-3kg.webp',
        },
      },
      create: {
        altText: 'Bolsa de alimento adulto para perros de 3 kg',
        productId: product.id,
        url: 'https://assets.dtodopets.local/products/alimento-adulto-3kg.webp',
      },
      update: {
        altText: 'Bolsa de alimento adulto para perros de 3 kg',
        sortOrder: 0,
      },
    });

    return {
      email: user.email,
      organizationSlug: organization.slug,
      productSku: 'DTP-ADULTO-3KG',
    };
  });

  console.log(
    `Development seed ready for ${result.email} in ${result.organizationSlug} with ${result.productSku}`,
  );
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
