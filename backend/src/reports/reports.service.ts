import { BadRequestException, Injectable } from '@nestjs/common';
import { createPage, getPagination } from '../common/pagination/pagination';
import { CartStatus, OrderStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DailySalesQueryDto,
  ReportRangeQueryDto,
} from './dto/report-query.dto';

const dayMilliseconds = 24 * 60 * 60 * 1000;
const defaultRangeDays = 30;
const maximumRangeDays = 366;
const realizedOrderStatuses = [
  OrderStatus.CONFIRMED,
  OrderStatus.COMPLETED,
] as const;

interface DailySalesRow {
  date: string;
  discountAmount: string;
  orderCount: number;
  shippingAmount: string;
  subtotalAmount: string;
  totalAmount: string;
}

interface DailySalesCountRow {
  dayCount: number;
}

type MonetarySums = {
  discountAmount: Prisma.Decimal | null;
  shippingAmount: Prisma.Decimal | null;
  subtotalAmount: Prisma.Decimal | null;
  totalAmount: Prisma.Decimal | null;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(organizationId: string, query: ReportRangeQueryDto) {
    const range = reportRange(query);
    const createdAt = { gte: range.from, lt: range.to };
    const orderGroups = await this.prisma.order.groupBy({
      by: ['status'],
      where: { createdAt, organizationId },
      _count: { _all: true },
      _sum: {
        discountAmount: true,
        shippingAmount: true,
        subtotalAmount: true,
        totalAmount: true,
      },
    });
    const activeCustomers = await this.prisma.customer.count({
      where: { active: true, organizationId },
    });
    const createdCustomers = await this.prisma.customer.count({
      where: { createdAt, organizationId },
    });
    const inventory = await this.prisma.inventoryBalance.aggregate({
      where: { organizationId },
      _sum: { physicalQuantity: true, reservedQuantity: true },
    });
    const payments = await this.prisma.payment.aggregate({
      where: { createdAt, organizationId },
      _count: { _all: true },
      _sum: { amount: true },
    });
    const refunds = await this.prisma.paymentRefund.aggregate({
      where: { createdAt, organizationId },
      _count: { _all: true },
      _sum: { amount: true },
    });
    const cartGroups = await this.prisma.cart.groupBy({
      by: ['status'],
      where: { createdAt, organizationId },
      _count: { _all: true },
    });
    const redemptions = await this.prisma.promotionRedemption.aggregate({
      where: {
        createdAt,
        organizationId,
        order: { status: { in: [...realizedOrderStatuses] } },
      },
      _count: { _all: true },
      _sum: { discountAmount: true },
    });

    const ordersByStatus = enumCounts(OrderStatus);
    for (const group of orderGroups) {
      ordersByStatus[group.status] = group._count._all;
    }
    const cartsByStatus = enumCounts(CartStatus);
    for (const group of cartGroups) {
      cartsByStatus[group.status] = group._count._all;
    }
    const realizedGroups = orderGroups.filter(({ status }) =>
      realizedOrderStatuses.includes(
        status as (typeof realizedOrderStatuses)[number],
      ),
    );
    const realizedOrderCount = realizedGroups.reduce(
      (sum, group) => sum + group._count._all,
      0,
    );
    const subtotalAmount = sumMoney(realizedGroups, 'subtotalAmount');
    const discountAmount = sumMoney(realizedGroups, 'discountAmount');
    const shippingAmount = sumMoney(realizedGroups, 'shippingAmount');
    const totalAmount = sumMoney(realizedGroups, 'totalAmount');
    const physicalQuantity = inventory._sum.physicalQuantity ?? 0;
    const reservedQuantity = inventory._sum.reservedQuantity ?? 0;
    const capturedAmount = money(payments._sum.amount);
    const refundedAmount = money(refunds._sum.amount);

    return {
      period: publicRange(range),
      currency: 'CLP',
      sales: {
        averageOrderValueAmount: roundedAverage(
          totalAmount,
          realizedOrderCount,
        ),
        discountAmount: discountAmount.toString(),
        orderCount: realizedOrderCount,
        shippingAmount: shippingAmount.toString(),
        subtotalAmount: subtotalAmount.toString(),
        totalAmount: totalAmount.toString(),
      },
      orders: {
        byStatus: ordersByStatus,
        total: totalOf(ordersByStatus),
      },
      customers: {
        active: activeCustomers,
        createdInPeriod: createdCustomers,
      },
      inventory: {
        availableQuantity: physicalQuantity - reservedQuantity,
        physicalQuantity,
        reservedQuantity,
      },
      payments: {
        capturedAmount: capturedAmount.toString(),
        netAmount: (capturedAmount - refundedAmount).toString(),
        paymentCount: payments._count._all,
        refundCount: refunds._count._all,
        refundedAmount: refundedAmount.toString(),
      },
      carts: {
        byStatus: cartsByStatus,
        total: totalOf(cartsByStatus),
      },
      promotions: {
        discountAmount: money(redemptions._sum.discountAmount).toString(),
        redemptionCount: redemptions._count._all,
      },
    };
  }

  async dailySales(organizationId: string, query: DailySalesQueryDto) {
    const range = reportRange(query);
    const { skip, take } = getPagination(query);
    const where = realizedOrdersSql(organizationId, range);
    const rows = await this.prisma.$queryRaw<DailySalesRow[]>(Prisma.sql`
      SELECT
        "createdAt"::date::text AS "date",
        COUNT(*)::int AS "orderCount",
        COALESCE(SUM("subtotalAmount"), 0)::text AS "subtotalAmount",
        COALESCE(SUM("discountAmount"), 0)::text AS "discountAmount",
        COALESCE(SUM("shippingAmount"), 0)::text AS "shippingAmount",
        COALESCE(SUM("totalAmount"), 0)::text AS "totalAmount"
      FROM "Order"
      WHERE ${where}
      GROUP BY "createdAt"::date
      ORDER BY "date" DESC
      OFFSET ${skip}
      LIMIT ${take}
    `);
    const countRows = await this.prisma.$queryRaw<DailySalesCountRow[]>(
      Prisma.sql`
        SELECT COUNT(*)::int AS "dayCount"
        FROM (
          SELECT "createdAt"::date
          FROM "Order"
          WHERE ${realizedOrdersSql(organizationId, range)}
          GROUP BY "createdAt"::date
        ) AS "salesDays"
      `,
    );
    const total = Number(countRows[0]?.dayCount ?? 0);
    const data = rows.map((row) => {
      const totalAmount = money(row.totalAmount);
      const orderCount = Number(row.orderCount);
      return {
        averageOrderValueAmount: roundedAverage(totalAmount, orderCount),
        date: row.date,
        discountAmount: money(row.discountAmount).toString(),
        orderCount,
        shippingAmount: money(row.shippingAmount).toString(),
        subtotalAmount: money(row.subtotalAmount).toString(),
        totalAmount: totalAmount.toString(),
      };
    });

    return {
      ...createPage(data, total, query),
      currency: 'CLP',
      period: publicRange(range),
    };
  }
}

interface ReportRange {
  from: Date;
  to: Date;
}

function reportRange(query: ReportRangeQueryDto): ReportRange {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - defaultRangeDays * dayMilliseconds);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
    throw new BadRequestException('Report range is invalid');
  }
  const duration = to.getTime() - from.getTime();
  if (duration <= 0) {
    throw new BadRequestException('to must be after from');
  }
  if (duration > maximumRangeDays * dayMilliseconds) {
    throw new BadRequestException(
      `Report range cannot exceed ${maximumRangeDays} days`,
    );
  }
  return { from, to };
}

function publicRange(range: ReportRange) {
  return {
    from: range.from.toISOString(),
    timeZone: 'UTC',
    to: range.to.toISOString(),
  };
}

function realizedOrdersSql(organizationId: string, range: ReportRange) {
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  return Prisma.sql`
    "organizationId" = ${organizationId}
    AND "status" IN (${Prisma.join([...realizedOrderStatuses])})
    AND "createdAt" >= (${from}::timestamptz AT TIME ZONE 'UTC')
    AND "createdAt" < (${to}::timestamptz AT TIME ZONE 'UTC')
  `;
}

function enumCounts<T extends string>(values: Record<string, T>) {
  return Object.fromEntries(
    Object.values(values).map((value) => [value, 0]),
  ) as Record<T, number>;
}

function totalOf(values: Record<string, number>) {
  return Object.values(values).reduce((sum, value) => sum + value, 0);
}

function sumMoney(
  groups: Array<{ _sum: MonetarySums }>,
  key: keyof MonetarySums,
) {
  return groups.reduce((sum, group) => sum + money(group._sum[key]), 0n);
}

function money(value: { toString(): string } | string | null | undefined) {
  return BigInt(new Prisma.Decimal(value?.toString() ?? '0').toFixed(0));
}

function roundedAverage(totalAmount: bigint, count: number) {
  if (count <= 0) return '0';
  const divisor = BigInt(count);
  return ((totalAmount + divisor / 2n) / divisor).toString();
}
