import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createRequestFingerprint } from '../common/idempotency/request-fingerprint';
import { toClpDecimal } from '../common/money/clp';
import { createPage, getPagination } from '../common/pagination/pagination';
import { normalizeEmail, normalizeSlug } from '../common/text/normalization';
import {
  normalizeChileanPhone,
  normalizeCustomerEmail,
} from '../customers/customer-normalization';
import { CustomersService } from '../customers/customers.service';
import {
  CartStatus,
  Prisma,
  SalesChannelType,
} from '../generated/prisma/client';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  bestPromotion,
  promotionDiscount,
  PromotionLine,
  subtotalOf,
} from '../promotions/promotion-pricing';
import {
  promotionInclude,
  PromotionsService,
  PromotionWithVariants,
} from '../promotions/promotions.service';
import {
  StorefrontAddressDto,
  StorefrontCatalogQueryDto,
  StorefrontCheckoutDto,
} from './dto/storefront.dto';

const publicProductSelect = {
  brand: { select: { name: true, slug: true } },
  category: { select: { name: true, slug: true } },
  description: true,
  id: true,
  images: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { altText: true, sortOrder: true, url: true },
  },
  lifeStage: true,
  name: true,
  slug: true,
  species: true,
  variants: {
    orderBy: { sku: 'asc' },
    select: {
      format: true,
      id: true,
      inventoryBalances: {
        where: { warehouse: { is: { active: true } } },
        select: { physicalQuantity: true, reservedQuantity: true },
      },
      name: true,
      priceAmount: true,
      salePriceAmount: true,
      sku: true,
      weightGrams: true,
    },
    where: { active: true },
  },
} satisfies Prisma.ProductSelect;

const cartInclude = {
  items: {
    include: {
      variant: {
        select: {
          active: true,
          format: true,
          id: true,
          inventoryBalances: {
            where: { warehouse: { is: { active: true } } },
            select: { physicalQuantity: true, reservedQuantity: true },
          },
          name: true,
          priceAmount: true,
          product: { select: { active: true, name: true, slug: true } },
          salePriceAmount: true,
          sku: true,
          weightGrams: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  order: {
    select: {
      createdAt: true,
      currency: true,
      discountAmount: true,
      id: true,
      items: {
        orderBy: { createdAt: 'asc' },
        select: {
          discountAmount: true,
          nameSnapshot: true,
          quantity: true,
          skuSnapshot: true,
          subtotalAmount: true,
          totalAmount: true,
          unitPriceAmount: true,
          variantId: true,
        },
      },
      number: true,
      promotionRedemptions: {
        orderBy: { createdAt: 'asc' },
        select: {
          codeSnapshot: true,
          discountAmount: true,
          nameSnapshot: true,
          promotionId: true,
          typeSnapshot: true,
          valueSnapshot: true,
        },
      },
      shippingAmount: true,
      status: true,
      subtotalAmount: true,
      totalAmount: true,
    },
  },
  promotion: { include: promotionInclude },
} satisfies Prisma.CartInclude;

interface StorefrontChannel {
  createdByUserId: string;
  id: string;
  key: string;
  metadata: Prisma.JsonValue | null;
  name: string;
  organizationId: string;
}

type CartRecord = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

interface LockedCart {
  expiresAt: Date;
  id: string;
  promotionId: string | null;
  status: CartStatus;
  version: number;
}

interface PricedCart {
  discountAmount: number;
  items: ReturnType<typeof publicCartItem>[];
  lines: PromotionLine[];
  promotion: PromotionWithVariants | null;
  subtotalAmount: number;
}

@Injectable()
export class StorefrontService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
    private readonly orders: OrdersService,
    private readonly promotionsService: PromotionsService,
  ) {}

  async catalog(
    organizationSlug: string,
    channelKey: string,
    query: StorefrontCatalogQueryDto,
  ) {
    const channel = await this.channel(organizationSlug, channelKey);
    const search = query.search?.trim();
    const where: Prisma.ProductWhereInput = {
      active: true,
      organizationId: channel.organizationId,
      species: query.species
        ? { equals: query.species.trim(), mode: 'insensitive' }
        : undefined,
      category: query.category
        ? {
            is: {
              active: true,
              slug: normalizeSlug(query.category),
            },
          }
        : undefined,
      variants: { some: { active: true } },
      AND: [
        { OR: [{ brandId: null }, { brand: { is: { active: true } } }] },
        {
          OR: [{ categoryId: null }, { category: { is: { active: true } } }],
        },
      ],
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              {
                variants: {
                  some: {
                    active: true,
                    sku: { contains: search, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const products = await this.prisma.product.findMany({
      where,
      select: publicProductSelect,
      ...getPagination(query),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    const total = await this.prisma.product.count({ where });
    return createPage(products.map(publicProduct), total, query);
  }

  async product(
    organizationSlug: string,
    channelKey: string,
    productSlug: string,
  ) {
    const channel = await this.channel(organizationSlug, channelKey);
    const product = await this.prisma.product.findFirst({
      where: {
        active: true,
        organizationId: channel.organizationId,
        slug: normalizeSlug(productSlug),
        variants: { some: { active: true } },
        AND: [
          { OR: [{ brandId: null }, { brand: { is: { active: true } } }] },
          {
            OR: [{ categoryId: null }, { category: { is: { active: true } } }],
          },
        ],
      },
      select: publicProductSelect,
    });
    if (!product) throw new NotFoundException('Product not found');
    return publicProduct(product);
  }

  async promotions(organizationSlug: string, channelKey: string) {
    const channel = await this.channel(organizationSlug, channelKey);
    const promotions = await this.promotionsService.findActiveAutomatic(
      channel.organizationId,
      channel.id,
      new Date(),
    );
    return promotions.map(publicPromotion);
  }

  async createCart(organizationSlug: string, channelKey: string) {
    const channel = await this.channel(organizationSlug, channelKey);
    const cartToken = randomBytes(32).toString('base64url');
    const cart = await this.prisma.cart.create({
      data: {
        accessTokenHash: hashToken(cartToken),
        expiresAt: new Date(Date.now() + cartTtlMilliseconds(channel.metadata)),
        organizationId: channel.organizationId,
        salesChannelId: channel.id,
      },
      include: cartInclude,
    });
    return {
      cart: await this.cartView(cart, channel),
      cartId: cart.id,
      cartToken,
    };
  }

  async cart(
    organizationSlug: string,
    channelKey: string,
    cartId: string,
    cartToken: string | undefined,
  ) {
    const channel = await this.channel(organizationSlug, channelKey);
    const cart = await this.authorizedCart(channel, cartId, cartToken);
    return this.cartView(cart, channel);
  }

  async setItem(
    organizationSlug: string,
    channelKey: string,
    cartId: string,
    cartToken: string | undefined,
    variantId: string,
    quantity: number,
  ) {
    const channel = await this.channel(organizationSlug, channelKey);
    const tokenHash = requiredTokenHash(cartToken);
    await this.prisma.$transaction(async (tx) => {
      await lockActiveCart(tx, channel, cartId, tokenHash);
      const variant = await tx.productVariant.findFirst({
        where: {
          active: true,
          id: variantId,
          organizationId: channel.organizationId,
          product: { is: { active: true } },
        },
        select: {
          id: true,
          inventoryBalances: {
            where: { warehouse: { is: { active: true } } },
            select: { physicalQuantity: true, reservedQuantity: true },
          },
        },
      });
      if (!variant) throw new NotFoundException('Product variant not found');
      if (availableQuantity(variant.inventoryBalances) < quantity) {
        throw new ConflictException('Insufficient available inventory');
      }
      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId, variantId } },
        create: {
          cartId,
          organizationId: channel.organizationId,
          quantity,
          variantId,
        },
        update: { quantity },
      });
      await tx.cart.update({
        where: { id: cartId },
        data: { version: { increment: 1 } },
      });
    });
    return this.cart(organizationSlug, channelKey, cartId, cartToken);
  }

  async removeItem(
    organizationSlug: string,
    channelKey: string,
    cartId: string,
    cartToken: string | undefined,
    variantId: string,
  ) {
    const channel = await this.channel(organizationSlug, channelKey);
    const tokenHash = requiredTokenHash(cartToken);
    await this.prisma.$transaction(async (tx) => {
      await lockActiveCart(tx, channel, cartId, tokenHash);
      const removed = await tx.cartItem.deleteMany({
        where: {
          cartId,
          organizationId: channel.organizationId,
          variantId,
        },
      });
      if (removed.count > 0) {
        await tx.cart.update({
          where: { id: cartId },
          data: { version: { increment: 1 } },
        });
      }
    });
    return this.cart(organizationSlug, channelKey, cartId, cartToken);
  }

  async applyPromotion(
    organizationSlug: string,
    channelKey: string,
    cartId: string,
    cartToken: string | undefined,
    code: string,
  ) {
    const channel = await this.channel(organizationSlug, channelKey);
    const promotion = await this.promotionsService.findActiveByCode(
      channel.organizationId,
      channel.id,
      code,
      new Date(),
    );
    const tokenHash = requiredTokenHash(cartToken);
    await this.prisma.$transaction(async (tx) => {
      await lockActiveCart(tx, channel, cartId, tokenHash);
      await tx.cart.update({
        where: { id: cartId },
        data: { promotionId: promotion.id, version: { increment: 1 } },
      });
    });
    return this.cart(organizationSlug, channelKey, cartId, cartToken);
  }

  async removePromotion(
    organizationSlug: string,
    channelKey: string,
    cartId: string,
    cartToken: string | undefined,
  ) {
    const channel = await this.channel(organizationSlug, channelKey);
    const tokenHash = requiredTokenHash(cartToken);
    await this.prisma.$transaction(async (tx) => {
      const cart = await lockActiveCart(tx, channel, cartId, tokenHash);
      if (cart.promotionId) {
        await tx.cart.update({
          where: { id: cartId },
          data: { promotionId: null, version: { increment: 1 } },
        });
      }
    });
    return this.cart(organizationSlug, channelKey, cartId, cartToken);
  }

  async checkout(
    organizationSlug: string,
    channelKey: string,
    cartId: string,
    cartToken: string | undefined,
    dto: StorefrontCheckoutDto,
  ) {
    const channel = await this.channel(organizationSlug, channelKey);
    const tokenHash = requiredTokenHash(cartToken);
    const cart = await this.authorizedCart(channel, cartId, cartToken);
    const normalized = normalizedCheckout(dto);
    const requestHash = createRequestFingerprint({
      cartId,
      checkout: normalized,
      version: cart.version,
    });
    if (cart.status === CartStatus.CHECKED_OUT) {
      assertCheckoutReplay(cart.checkoutRequestHash, requestHash);
      if (!cart.order) throw new ConflictException('Checkout is incomplete');
      return { idempotent: true, order: publicOrder(cart.order) };
    }
    if (cart.status !== CartStatus.ACTIVE) {
      throw new ConflictException('Cart is not active');
    }
    if (cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }
    const priced = await this.priceCart(cart, channel);
    for (const item of priced.items) {
      if (!item.active || item.quantity > item.availableQuantity) {
        throw new ConflictException('Cart contains unavailable inventory');
      }
    }
    const customer = await this.resolveCustomer(
      channel.organizationId,
      normalized.customer,
    );
    const address = await this.resolveAddress(
      channel.organizationId,
      customer.id,
      normalized.shippingAddress,
    );
    const warehouseId = await this.selectWarehouse(
      channel.organizationId,
      priced.items,
    );
    const shippingAmount = storefrontShippingAmount(channel.metadata);
    const checkoutVersion = cart.version;
    try {
      const order = await this.orders.create(
        channel.organizationId,
        channel.createdByUserId,
        {
          customerAddressId: address.id,
          customerId: customer.id,
          discountAmount: priced.discountAmount,
          items: priced.items.map((item) => ({
            quantity: item.quantity,
            variantId: item.variantId,
          })),
          notes: normalized.notes,
          shippingAmount,
          warehouseId,
        },
        { requestHash, storefrontCartId: cartId },
        {
          beforeCreate: async (tx) => {
            const locked = await lockActiveCart(tx, channel, cartId, tokenHash);
            if (locked.version !== checkoutVersion) {
              throw new ConflictException('Cart changed during checkout');
            }
            if (priced.promotion) {
              await lockPromotion(
                tx,
                channel.organizationId,
                channel.id,
                priced.promotion,
              );
            }
          },
          afterCreate: async (tx, orderId) => {
            await finalizeCheckout(
              tx,
              channel,
              cartId,
              customer.id,
              orderId,
              requestHash,
              priced.promotion,
              priced.discountAmount,
            );
          },
        },
      );
      return { idempotent: false, order: publicOrder(order) };
    } catch (error) {
      const concurrent = await this.prisma.order.findFirst({
        where: {
          organizationId: channel.organizationId,
          storefrontCartId: cartId,
        },
        select: {
          createdAt: true,
          currency: true,
          discountAmount: true,
          id: true,
          number: true,
          shippingAmount: true,
          sourceRequestHash: true,
          status: true,
          subtotalAmount: true,
          totalAmount: true,
        },
      });
      if (!concurrent) throw error;
      assertCheckoutReplay(concurrent.sourceRequestHash, requestHash);
      return { idempotent: true, order: publicOrder(concurrent) };
    }
  }

  private channel(organizationSlug: string, channelKey: string) {
    return this.prisma.salesChannel
      .findFirst({
        where: {
          active: true,
          key: normalizeSlug(channelKey),
          organization: {
            is: { active: true, slug: normalizeSlug(organizationSlug) },
          },
          type: SalesChannelType.OWN_STOREFRONT,
        },
        select: {
          createdByUserId: true,
          id: true,
          key: true,
          metadata: true,
          name: true,
          organizationId: true,
        },
      })
      .then((channel) => {
        if (!channel) throw new NotFoundException('Storefront not found');
        return channel;
      });
  }

  private async authorizedCart(
    channel: StorefrontChannel,
    cartId: string,
    cartToken: string | undefined,
  ) {
    const cart = await this.prisma.cart.findFirst({
      where: {
        accessTokenHash: requiredTokenHash(cartToken),
        id: cartId,
        organizationId: channel.organizationId,
        salesChannelId: channel.id,
      },
      include: cartInclude,
    });
    if (!cart) throw new NotFoundException('Cart not found');
    if (cart.status === CartStatus.ACTIVE && cart.expiresAt <= new Date()) {
      throw new GoneException('Cart expired');
    }
    return cart;
  }

  private async priceCart(cart: CartRecord, channel: StorefrontChannel) {
    const items = cart.items.map(publicCartItem);
    const lines = items.map(({ quantity, unitPriceAmount, variantId }) => ({
      quantity,
      unitPriceAmount,
      variantId,
    }));
    const now = new Date();
    let promotion: PromotionWithVariants | null = null;
    let discountAmount = 0;
    if (cart.promotion && isActiveForChannel(cart.promotion, channel.id, now)) {
      promotion = cart.promotion;
      discountAmount = promotionDiscount(promotion, lines);
    } else if (!cart.promotionId) {
      const automatic = await this.promotionsService.findActiveAutomatic(
        channel.organizationId,
        channel.id,
        now,
      );
      const best = bestPromotion(automatic, lines);
      promotion = best.promotion;
      discountAmount = best.discountAmount;
    }
    return {
      discountAmount,
      items,
      lines,
      promotion,
      subtotalAmount: subtotalOf(lines),
    } satisfies PricedCart;
  }

  private async cartView(cart: CartRecord, channel: StorefrontChannel) {
    if (cart.status === CartStatus.CHECKED_OUT && cart.order) {
      const redemption = cart.order.promotionRedemptions[0];
      return {
        checkedOutAt: cart.checkedOutAt,
        createdAt: cart.createdAt,
        currency: cart.order.currency,
        discountAmount: cart.order.discountAmount,
        expiresAt: cart.expiresAt,
        id: cart.id,
        items: cart.order.items.map((item) => ({
          discountAmount: item.discountAmount,
          lineSubtotalAmount: item.subtotalAmount,
          lineTotalAmount: item.totalAmount,
          name: item.nameSnapshot,
          quantity: item.quantity,
          sku: item.skuSnapshot,
          unitPriceAmount: item.unitPriceAmount,
          variantId: item.variantId,
        })),
        order: publicOrder(cart.order),
        promotion: redemption
          ? {
              code: redemption.codeSnapshot,
              discountAmount: redemption.discountAmount,
              id: redemption.promotionId,
              name: redemption.nameSnapshot,
              type: redemption.typeSnapshot,
              value: redemption.valueSnapshot,
            }
          : null,
        status: cart.status,
        subtotalAmount: cart.order.subtotalAmount,
        totalAmount: cart.order.totalAmount,
        updatedAt: cart.updatedAt,
        version: cart.version,
      };
    }
    const priced = await this.priceCart(cart, channel);
    return {
      checkedOutAt: cart.checkedOutAt,
      createdAt: cart.createdAt,
      currency: 'CLP',
      discountAmount: String(priced.discountAmount),
      expiresAt: cart.expiresAt,
      id: cart.id,
      items: priced.items.map(({ unitPriceAmount, ...item }) => ({
        ...item,
        lineSubtotalAmount: String(unitPriceAmount * item.quantity),
        unitPriceAmount: String(unitPriceAmount),
      })),
      order: cart.order,
      promotion: priced.promotion
        ? {
            code: priced.promotion.automatic ? null : priced.promotion.code,
            discountAmount: String(priced.discountAmount),
            id: priced.promotion.id,
            name: priced.promotion.name,
            type: priced.promotion.type,
            value: priced.promotion.value,
          }
        : null,
      status: cart.status,
      subtotalAmount: String(priced.subtotalAmount),
      totalAmount: String(priced.subtotalAmount - priced.discountAmount),
      updatedAt: cart.updatedAt,
      version: cart.version,
    };
  }

  private async resolveCustomer(
    organizationId: string,
    customer: ReturnType<typeof normalizedCheckout>['customer'],
  ) {
    const email = normalizeCustomerEmail(customer.email);
    let existing = await this.prisma.customer.findFirst({
      where: { email, organizationId },
    });
    if (!existing) {
      try {
        existing = await this.customers.create(organizationId, {
          email,
          name: customer.name,
          phone: customer.phone,
        });
      } catch (error) {
        existing = await this.prisma.customer.findFirst({
          where: { email, organizationId },
        });
        if (!existing) throw error;
      }
    }
    if (!existing.active) throw new BadRequestException('Customer is inactive');
    return existing;
  }

  private async resolveAddress(
    organizationId: string,
    customerId: string,
    address: ReturnType<typeof normalizedCheckout>['shippingAddress'],
  ) {
    const label = `Storefront ${createRequestFingerprint(address).slice(0, 32)}`;
    let existing = await this.prisma.customerAddress.findFirst({
      where: { customerId, label, organizationId },
    });
    if (!existing) {
      try {
        existing = await this.customers.createAddress(
          organizationId,
          customerId,
          { ...address, label },
        );
      } catch (error) {
        existing = await this.prisma.customerAddress.findFirst({
          where: { customerId, label, organizationId },
        });
        if (!existing) throw error;
      }
    }
    if (!existing.active) {
      throw new BadRequestException('Shipping address is inactive');
    }
    return existing;
  }

  private async selectWarehouse(
    organizationId: string,
    items: Array<{ quantity: number; variantId: string }>,
  ) {
    const warehouses = await this.prisma.warehouse.findMany({
      where: { active: true, organizationId },
      select: {
        id: true,
        inventoryBalances: {
          where: { variantId: { in: items.map(({ variantId }) => variantId) } },
          select: {
            physicalQuantity: true,
            reservedQuantity: true,
            variantId: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    const warehouse = warehouses.find(({ inventoryBalances }) => {
      const quantities = new Map(
        inventoryBalances.map((balance) => [
          balance.variantId,
          balance.physicalQuantity - balance.reservedQuantity,
        ]),
      );
      return items.every(
        ({ quantity, variantId }) =>
          (quantities.get(variantId) ?? 0) >= quantity,
      );
    });
    if (!warehouse) {
      throw new ConflictException('No warehouse can fulfill the complete cart');
    }
    return warehouse.id;
  }
}

function publicProduct(
  product: Prisma.ProductGetPayload<{ select: typeof publicProductSelect }>,
) {
  return {
    ...product,
    variants: product.variants.map(({ inventoryBalances, ...variant }) => ({
      ...variant,
      availableQuantity: availableQuantity(inventoryBalances),
    })),
  };
}

function publicCartItem(item: CartRecord['items'][number]) {
  const unitPriceAmount = Number(
    item.variant.salePriceAmount ?? item.variant.priceAmount,
  );
  return {
    active: item.variant.active && item.variant.product.active,
    availableQuantity: availableQuantity(item.variant.inventoryBalances),
    format: item.variant.format,
    name: item.variant.name,
    productName: item.variant.product.name,
    productSlug: item.variant.product.slug,
    quantity: item.quantity,
    sku: item.variant.sku,
    unitPriceAmount,
    variantId: item.variantId,
    weightGrams: item.variant.weightGrams,
  };
}

function publicPromotion(promotion: PromotionWithVariants) {
  return {
    description: promotion.description,
    endsAt: promotion.endsAt,
    id: promotion.id,
    maximumDiscountAmount: promotion.maximumDiscountAmount,
    minimumSubtotalAmount: promotion.minimumSubtotalAmount,
    name: promotion.name,
    scope: promotion.scope,
    startsAt: promotion.startsAt,
    type: promotion.type,
    value: promotion.value,
    variantIds: promotion.variants.map(({ variantId }) => variantId),
  };
}

function publicOrder<
  T extends {
    createdAt: Date;
    currency: string;
    discountAmount: { toString(): string };
    id: string;
    number: string;
    shippingAmount: { toString(): string };
    status: string;
    subtotalAmount: { toString(): string };
    totalAmount: { toString(): string };
  },
>(order: T) {
  return {
    createdAt: order.createdAt,
    currency: order.currency,
    discountAmount: order.discountAmount,
    id: order.id,
    number: order.number,
    shippingAmount: order.shippingAmount,
    status: order.status,
    subtotalAmount: order.subtotalAmount,
    totalAmount: order.totalAmount,
  };
}

function availableQuantity(
  balances: Array<{ physicalQuantity: number; reservedQuantity: number }>,
) {
  return balances.reduce(
    (sum, balance) => sum + balance.physicalQuantity - balance.reservedQuantity,
    0,
  );
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function requiredTokenHash(token: string | undefined) {
  if (!token || token.length > 200)
    throw new NotFoundException('Cart not found');
  return hashToken(token);
}

async function lockActiveCart(
  tx: Prisma.TransactionClient,
  channel: StorefrontChannel,
  cartId: string,
  tokenHash: string,
) {
  const rows = await tx.$queryRaw<LockedCart[]>`
    SELECT "id", "status", "expiresAt", "version", "promotionId"
    FROM "Cart"
    WHERE "id" = ${cartId}
      AND "organizationId" = ${channel.organizationId}
      AND "salesChannelId" = ${channel.id}
      AND "accessTokenHash" = ${tokenHash}
    FOR UPDATE
  `;
  const cart = rows[0];
  if (!cart) throw new NotFoundException('Cart not found');
  if (cart.status !== CartStatus.ACTIVE) {
    throw new ConflictException('Cart is not active');
  }
  if (cart.expiresAt <= new Date()) throw new GoneException('Cart expired');
  return cart;
}

async function lockPromotion(
  tx: Prisma.TransactionClient,
  organizationId: string,
  salesChannelId: string,
  promotion: PromotionWithVariants,
) {
  await tx.$queryRaw`
    SELECT "id" FROM "Promotion"
    WHERE "id" = ${promotion.id} AND "organizationId" = ${organizationId}
    FOR UPDATE
  `;
  const current = await tx.promotion.findFirst({
    where: { id: promotion.id, organizationId },
    select: {
      active: true,
      endsAt: true,
      salesChannelId: true,
      startsAt: true,
      updatedAt: true,
    },
  });
  const now = new Date();
  if (
    !current ||
    current.updatedAt.getTime() !== promotion.updatedAt.getTime() ||
    !current.active ||
    current.startsAt > now ||
    (current.endsAt !== null && current.endsAt <= now) ||
    (current.salesChannelId !== null &&
      current.salesChannelId !== salesChannelId)
  ) {
    throw new ConflictException('Promotion changed during checkout');
  }
}

async function finalizeCheckout(
  tx: Prisma.TransactionClient,
  channel: StorefrontChannel,
  cartId: string,
  customerId: string,
  orderId: string,
  requestHash: string,
  promotion: PromotionWithVariants | null,
  discountAmount: number,
) {
  const orderItems = await tx.orderItem.findMany({
    where: { orderId, organizationId: channel.organizationId },
    select: { quantity: true, unitPriceAmount: true, variantId: true },
  });
  const lines = orderItems.map((item) => ({
    quantity: item.quantity,
    unitPriceAmount: Number(item.unitPriceAmount),
    variantId: item.variantId,
  }));
  const verifiedDiscount = promotion ? promotionDiscount(promotion, lines) : 0;
  if (verifiedDiscount !== discountAmount) {
    throw new ConflictException('Promotion price changed during checkout');
  }
  if (promotion && discountAmount > 0) {
    await tx.promotionRedemption.create({
      data: {
        codeSnapshot: promotion.code,
        customerId,
        discountAmount: toClpDecimal(discountAmount),
        nameSnapshot: promotion.name,
        orderId,
        organizationId: channel.organizationId,
        promotionId: promotion.id,
        typeSnapshot: promotion.type,
        valueSnapshot: promotion.value,
      },
    });
  }
  await tx.cart.update({
    where: { id: cartId },
    data: {
      checkedOutAt: new Date(),
      checkoutRequestHash: requestHash,
      customerId,
      promotionId: promotion?.id ?? null,
      status: CartStatus.CHECKED_OUT,
    },
  });
  await tx.domainEvent.create({
    data: {
      aggregateId: cartId,
      aggregateType: 'storefront-cart',
      organizationId: channel.organizationId,
      payload: {
        cartId,
        discountAmount,
        orderId,
        promotionId: promotion?.id ?? null,
        salesChannelId: channel.id,
      },
      type: 'storefront.checkout.completed',
    },
  });
}

function normalizedCheckout(dto: StorefrontCheckoutDto) {
  return {
    customer: {
      email: normalizeEmail(dto.customer.email),
      name: dto.customer.name.trim(),
      phone: dto.customer.phone
        ? normalizeChileanPhone(dto.customer.phone)
        : undefined,
    },
    notes: dto.notes?.trim() || undefined,
    shippingAddress: normalizedAddress(dto.shippingAddress),
  };
}

function normalizedAddress(dto: StorefrontAddressDto) {
  return {
    addressLine1: dto.addressLine1.trim(),
    addressLine2: dto.addressLine2?.trim() || undefined,
    city: dto.city.trim(),
    commune: dto.commune.trim(),
    instructions: dto.instructions?.trim() || undefined,
    phone: dto.phone ? normalizeChileanPhone(dto.phone) : undefined,
    postalCode: dto.postalCode?.trim() || undefined,
    recipientName: dto.recipientName?.trim() || undefined,
    region: dto.region.trim(),
  };
}

function assertCheckoutReplay(storedHash: string | null, requestHash: string) {
  if (storedHash !== requestHash) {
    throw new ConflictException('Checkout was reused with a different payload');
  }
}

function isActiveForChannel(
  promotion: PromotionWithVariants,
  channelId: string,
  at: Date,
) {
  return (
    promotion.active &&
    !promotion.automatic &&
    promotion.startsAt <= at &&
    (!promotion.endsAt || promotion.endsAt > at) &&
    (!promotion.salesChannelId || promotion.salesChannelId === channelId)
  );
}

function cartTtlMilliseconds(metadata: Prisma.JsonValue | null) {
  const hours = jsonNumber(metadata, 'cartTtlHours');
  return (
    (Number.isInteger(hours) && hours! >= 1 && hours! <= 168 ? hours! : 24) *
    60 *
    60 *
    1000
  );
}

function storefrontShippingAmount(metadata: Prisma.JsonValue | null) {
  const amount = jsonNumber(metadata, 'defaultShippingAmount');
  if (amount === undefined) return 0;
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
}

function jsonNumber(value: Prisma.JsonValue | null, key: string) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value[key];
  return typeof candidate === 'number' ? candidate : undefined;
}
