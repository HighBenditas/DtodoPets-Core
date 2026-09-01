import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { toClpDecimal } from '../common/money/clp';
import {
  ExternalEntityType,
  InventoryMovementType,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getValidSlug } from '../catalog/brands/brands.service';
import { ApplyRelbaseStockDto } from './dto/apply-relbase-stock.dto';
import {
  isValidImportRow,
  parseRelbaseStock,
  type RelbaseStockRow,
} from './relbase-stock.parser';

interface LockedBalance {
  id: string;
  physicalQuantity: number;
  reservedQuantity: number;
}

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(file: Express.Multer.File) {
    const parsed = await parseRelbaseStock(file.buffer);
    return {
      file: fileDetails(file),
      issues: parsed.issues.slice(0, 250),
      issuesTruncated: parsed.issues.length > 250,
      rows: parsed.rows.slice(0, 100),
      rowsTruncated: parsed.rows.length > 100,
      sheetName: parsed.sheetName,
      summary: parsed.summary,
    };
  }

  async apply(
    organizationId: string,
    actorUserId: string,
    file: Express.Multer.File,
    dto: ApplyRelbaseStockDto,
  ) {
    const parsed = await parseRelbaseStock(file.buffer);
    if (parsed.summary.blockingIssues > 0 && !dto.skipInvalidRows) {
      throw new BadRequestException({
        code: 'IMPORT_BLOCKED',
        issues: parsed.issues
          .filter(({ severity }) => severity === 'error')
          .slice(0, 100),
        message:
          'El archivo contiene filas bloqueadas. Corrígelas o confirma que deseas omitirlas.',
        summary: parsed.summary,
      });
    }

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { active: true, id: dto.warehouseId, organizationId },
      select: { id: true, name: true },
    });
    if (!warehouse) throw new BadRequestException('warehouseId is invalid');

    const rows = parsed.rows.filter(isValidImportRow);
    if (rows.length === 0) {
      throw new BadRequestException(
        'El archivo no contiene filas válidas para importar',
      );
    }

    const fileHash = sha256(file.buffer);
    const operationId = randomUUID();
    try {
      const result = await this.prisma.$transaction(
        async (transaction) => {
          const integration = await transaction.integration.upsert({
            where: {
              organizationId_key: { key: 'relbase', organizationId },
            },
            create: {
              config: { apiVersion: 'v2', marketplaceStockSafety: 1 },
              createdByUserId: actorUserId,
              key: 'relbase',
              name: 'relBase',
              organizationId,
              provider: 'relbase',
            },
            update: { active: true, name: 'relBase', provider: 'relbase' },
          });
          const categories = await upsertCategories(
            transaction,
            organizationId,
            rows.map(({ category }) => category),
          );
          const counts = {
            created: 0,
            inventoryAdjusted: 0,
            unchanged: 0,
            updated: 0,
          };

          for (const row of rows) {
            const categoryId = categories.get(normalizedKey(row.category));
            if (!categoryId) {
              throw new ConflictException(
                `No se pudo resolver la categoría de la fila ${row.row}`,
              );
            }
            const imported = await upsertImportedVariant(
              transaction,
              organizationId,
              actorUserId,
              integration.id,
              categoryId,
              row,
            );
            counts[imported.created ? 'created' : 'updated'] += 1;

            const balance = await transaction.inventoryBalance.upsert({
              where: {
                organizationId_warehouseId_variantId: {
                  organizationId,
                  variantId: imported.variantId,
                  warehouseId: warehouse.id,
                },
              },
              create: {
                organizationId,
                variantId: imported.variantId,
                warehouseId: warehouse.id,
              },
              update: {},
              select: { id: true },
            });
            const locked = await lockBalance(
              transaction,
              organizationId,
              balance.id,
            );
            if (row.stockQuantity < locked.reservedQuantity) {
              throw new ConflictException(
                `La fila ${row.row} informa menos stock que el actualmente reservado`,
              );
            }
            const physicalDelta = row.stockQuantity - locked.physicalQuantity;
            if (physicalDelta === 0) {
              counts.unchanged += 1;
              continue;
            }
            await transaction.inventoryBalance.update({
              where: { id: locked.id },
              data: { physicalQuantity: row.stockQuantity },
            });
            await transaction.inventoryMovement.create({
              data: {
                actorUserId,
                balanceId: locked.id,
                operationId,
                organizationId,
                physicalAfter: row.stockQuantity,
                physicalBefore: locked.physicalQuantity,
                physicalDelta,
                reason: `Importación de stock relBase: ${file.originalname}`,
                referenceId: fileHash,
                referenceType: 'relbase-stock-import',
                reservedAfter: locked.reservedQuantity,
                reservedBefore: locked.reservedQuantity,
                reservedDelta: 0,
                type: InventoryMovementType.ADJUSTMENT,
              },
            });
            counts.inventoryAdjusted += 1;
          }

          await transaction.domainEvent.create({
            data: {
              aggregateId: operationId,
              aggregateType: 'stock-import',
              organizationId,
              payload: {
                ...counts,
                fileHash,
                fileName: file.originalname,
                skipped: parsed.rows.length - rows.length,
                warehouseId: warehouse.id,
              },
              type: 'relbase.stock-imported',
            },
          });
          return counts;
        },
        { maxWait: 10_000, timeout: 120_000 },
      );

      return {
        ...result,
        file: fileDetails(file),
        operationId,
        skipped: parsed.rows.length - rows.length,
        totalRows: parsed.rows.length,
        warehouse,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'La importación encontró un SKU, código de barras o referencia relBase ya asociado a otro producto',
        );
      }
      throw error;
    }
  }
}

async function upsertCategories(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  names: string[],
) {
  const result = new Map<string, string>();
  for (const name of [...new Set(names)]) {
    const slug = getValidSlug(name);
    const category = await transaction.category.upsert({
      where: { organizationId_slug: { organizationId, slug } },
      create: { name, organizationId, slug },
      update: { active: true, name },
      select: { id: true },
    });
    result.set(normalizedKey(name), category.id);
  }
  return result;
}

async function upsertImportedVariant(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  actorUserId: string,
  integrationId: string,
  categoryId: string,
  row: RelbaseStockRow,
) {
  const reference = await transaction.externalReference.findUnique({
    where: {
      integrationId_entityType_externalId: {
        entityType: ExternalEntityType.VARIANT,
        externalId: row.sourceCode,
        integrationId,
      },
    },
  });
  const candidates = reference
    ? await transaction.productVariant.findMany({
        where: { id: reference.entityId, organizationId },
        include: { product: true },
      })
    : await transaction.productVariant.findMany({
        where: {
          organizationId,
          OR: [
            { sku: row.sku },
            ...(row.barcode ? [{ barcode: row.barcode }] : []),
          ],
        },
        include: { product: true },
        take: 2,
      });
  if (candidates.length > 1) {
    throw new ConflictException(
      `La fila ${row.row} coincide con más de una variante existente`,
    );
  }

  let variantId: string;
  let created = false;
  const current = candidates[0];
  if (current) {
    const entityReference = await transaction.externalReference.findUnique({
      where: {
        integrationId_entityType_entityId: {
          entityId: current.id,
          entityType: ExternalEntityType.VARIANT,
          integrationId,
        },
      },
    });
    if (entityReference && entityReference.externalId !== row.sourceCode) {
      throw new ConflictException(
        `La fila ${row.row} intenta reutilizar una variante asociada a otro código relBase`,
      );
    }
    await transaction.product.update({
      where: { id: current.productId },
      data: {
        active: row.active,
        categoryId,
        name: row.productName,
      },
    });
    await transaction.productVariant.update({
      where: { id: current.id },
      data: variantData(row),
    });
    variantId = current.id;
  } else {
    const product = await transaction.product.create({
      data: {
        active: row.active,
        categoryId,
        name: row.productName,
        organizationId,
        slug: getValidSlug(`${row.productName}-${row.sourceCode}`),
      },
    });
    const variant = await transaction.productVariant.create({
      data: {
        ...variantData(row),
        organizationId,
        productId: product.id,
      },
      select: { id: true },
    });
    variantId = variant.id;
    created = true;
  }

  await transaction.externalReference.upsert({
    where: {
      integrationId_entityType_externalId: {
        entityType: ExternalEntityType.VARIANT,
        externalId: row.sourceCode,
        integrationId,
      },
    },
    create: {
      createdByUserId: actorUserId,
      entityId: variantId,
      entityType: ExternalEntityType.VARIANT,
      externalId: row.sourceCode,
      integrationId,
      metadata: {
        barcode: row.barcode,
        provider: row.provider,
        sourceRow: row.row,
      },
      organizationId,
    },
    update: {
      entityId: variantId,
      metadata: {
        barcode: row.barcode,
        provider: row.provider,
        sourceRow: row.row,
      },
    },
  });
  return { created, variantId };
}

function variantData(row: RelbaseStockRow) {
  return {
    active: row.active,
    barcode: row.barcode,
    costAmount: toClpDecimal(row.costAmount),
    priceAmount: toClpDecimal(row.grossPriceAmount),
    salePriceAmount: null,
    sku: row.sku,
  } satisfies Prisma.ProductVariantUncheckedUpdateInput;
}

async function lockBalance(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  balanceId: string,
) {
  const [balance] = await transaction.$queryRaw<LockedBalance[]>(Prisma.sql`
    SELECT "id", "physicalQuantity", "reservedQuantity"
    FROM "InventoryBalance"
    WHERE "organizationId" = ${organizationId} AND "id" = ${balanceId}
    FOR UPDATE
  `);
  if (!balance)
    throw new ConflictException('No se pudo bloquear el saldo de inventario');
  return balance;
}

function normalizedKey(value: string) {
  return value.trim().toLocaleLowerCase('es-CL');
}

function sha256(value: Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function fileDetails(file: Express.Multer.File) {
  return {
    name: file.originalname,
    sha256: sha256(file.buffer),
    size: file.size,
  };
}
