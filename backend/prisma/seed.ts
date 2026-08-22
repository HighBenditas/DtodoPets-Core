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

    return { email: user.email, organizationSlug: organization.slug };
  });

  console.log(
    `Development seed ready for ${result.email} in ${result.organizationSlug}`,
  );
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
