import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createPage, getPagination } from '../common/pagination/pagination';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  normalizeChileanPhone,
  normalizeChileanRut,
  normalizeCustomerEmail,
} from './customer-normalization';
import { CreateCustomerAddressDto } from './dto/create-customer-address.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { UpdateCustomerAddressDto } from './dto/update-customer-address.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const customerListInclude = {
  _count: { select: { addresses: { where: { active: true } } } },
} satisfies Prisma.CustomerInclude;

const customerDetailInclude = {
  addresses: {
    orderBy: [{ isDefault: 'desc' }, { active: 'desc' }, { label: 'asc' }],
  },
} satisfies Prisma.CustomerInclude;

interface LockedCustomer {
  active: boolean;
  id: string;
  name: string;
  organizationId: string;
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: CustomerQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.CustomerWhereInput = {
      organizationId,
      active: query.active,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { rut: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: customerListInclude,
        ...getPagination(query),
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.customer.count({ where }),
    ]);
    return createPage(data, total, query);
  }

  async findOne(organizationId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, organizationId },
      include: customerDetailInclude,
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async findAddresses(organizationId: string, customerId: string) {
    await this.findOne(organizationId, customerId);
    return this.prisma.customerAddress.findMany({
      where: { customerId, organizationId },
      orderBy: [{ isDefault: 'desc' }, { active: 'desc' }, { label: 'asc' }],
    });
  }

  async create(organizationId: string, dto: CreateCustomerDto) {
    try {
      return await this.prisma.customer.create({
        data: {
          active: dto.active ?? true,
          email: dto.email ? normalizeCustomerEmail(dto.email) : null,
          name: normalizeRequiredText(dto.name, 'name'),
          notes: normalizeOptionalText(dto.notes),
          organizationId,
          phone: dto.phone ? normalizeChileanPhone(dto.phone) : null,
          rut: dto.rut ? normalizeChileanRut(dto.rut) : null,
        },
        include: customerDetailInclude,
      });
    } catch (error) {
      throwCustomerConflict(error);
      throw error;
    }
  }

  async update(organizationId: string, id: string, dto: UpdateCustomerDto) {
    await this.findOne(organizationId, id);
    const data: Prisma.CustomerUncheckedUpdateInput = {};
    if (dto.name !== undefined)
      data.name = normalizeRequiredText(dto.name, 'name');
    if (dto.email !== undefined) {
      data.email =
        dto.email === null ? null : normalizeCustomerEmail(dto.email);
    }
    if (dto.phone !== undefined) {
      data.phone = dto.phone === null ? null : normalizeChileanPhone(dto.phone);
    }
    if (dto.rut !== undefined) {
      data.rut = dto.rut === null ? null : normalizeChileanRut(dto.rut);
    }
    if (dto.notes !== undefined) data.notes = normalizeNullableText(dto.notes);
    if (dto.active !== undefined) data.active = dto.active;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }

    try {
      return await this.prisma.customer.update({
        where: { id },
        data,
        include: customerDetailInclude,
      });
    } catch (error) {
      throwCustomerConflict(error);
      throw error;
    }
  }

  async createAddress(
    organizationId: string,
    customerId: string,
    dto: CreateCustomerAddressDto,
  ) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const customer = await lockCustomer(
          transaction,
          organizationId,
          customerId,
        );
        if (!customer.active) {
          throw new BadRequestException('Customer is inactive');
        }
        const activeAddressCount = await transaction.customerAddress.count({
          where: { active: true, customerId, organizationId },
        });
        const isDefault = activeAddressCount === 0 || dto.isDefault === true;
        if (isDefault) {
          await transaction.customerAddress.updateMany({
            where: { customerId, isDefault: true, organizationId },
            data: { isDefault: false },
          });
        }
        return transaction.customerAddress.create({
          data: {
            active: true,
            addressLine1: normalizeRequiredText(
              dto.addressLine1,
              'addressLine1',
            ),
            addressLine2: normalizeOptionalText(dto.addressLine2),
            city: normalizeRequiredText(dto.city, 'city'),
            commune: normalizeRequiredText(dto.commune, 'commune'),
            customerId,
            instructions: normalizeOptionalText(dto.instructions),
            isDefault,
            label: normalizeRequiredText(dto.label, 'label'),
            organizationId,
            phone: dto.phone ? normalizeChileanPhone(dto.phone) : null,
            postalCode: normalizeOptionalText(dto.postalCode),
            recipientName: dto.recipientName?.trim() || customer.name,
            region: normalizeRequiredText(dto.region, 'region'),
          },
        });
      });
    } catch (error) {
      throwCustomerConflict(error);
      throw error;
    }
  }

  async updateAddress(
    organizationId: string,
    customerId: string,
    addressId: string,
    dto: UpdateCustomerAddressDto,
  ) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        await lockCustomer(transaction, organizationId, customerId);
        const current = await transaction.customerAddress.findFirst({
          where: { customerId, id: addressId, organizationId },
        });
        if (!current) throw new NotFoundException('Customer address not found');
        const data: Prisma.CustomerAddressUncheckedUpdateInput = {};
        if (dto.label !== undefined)
          data.label = normalizeRequiredText(dto.label, 'label');
        if (dto.recipientName !== undefined)
          data.recipientName = normalizeRequiredText(
            dto.recipientName,
            'recipientName',
          );
        if (dto.phone !== undefined) {
          data.phone =
            dto.phone === null ? null : normalizeChileanPhone(dto.phone);
        }
        if (dto.addressLine1 !== undefined)
          data.addressLine1 = normalizeRequiredText(
            dto.addressLine1,
            'addressLine1',
          );
        if (dto.addressLine2 !== undefined)
          data.addressLine2 = normalizeNullableText(dto.addressLine2);
        if (dto.commune !== undefined)
          data.commune = normalizeRequiredText(dto.commune, 'commune');
        if (dto.city !== undefined)
          data.city = normalizeRequiredText(dto.city, 'city');
        if (dto.region !== undefined)
          data.region = normalizeRequiredText(dto.region, 'region');
        if (dto.postalCode !== undefined)
          data.postalCode = normalizeNullableText(dto.postalCode);
        if (dto.instructions !== undefined)
          data.instructions = normalizeNullableText(dto.instructions);
        if (dto.active !== undefined) data.active = dto.active;
        if (Object.keys(data).length === 0) {
          throw new BadRequestException('At least one field must be provided');
        }

        if (dto.active === false && current.isDefault) data.isDefault = false;
        if (dto.active === true && !current.active) {
          const defaultAddress = await transaction.customerAddress.findFirst({
            where: {
              active: true,
              customerId,
              isDefault: true,
              organizationId,
            },
            select: { id: true },
          });
          if (!defaultAddress) data.isDefault = true;
        }

        const updated = await transaction.customerAddress.update({
          where: { id: addressId },
          data,
        });
        if (dto.active === false && current.isDefault) {
          const next = await transaction.customerAddress.findFirst({
            where: {
              active: true,
              customerId,
              id: { not: addressId },
              organizationId,
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: { id: true },
          });
          if (next) {
            await transaction.customerAddress.update({
              where: { id: next.id },
              data: { isDefault: true },
            });
          }
        }
        return updated;
      });
    } catch (error) {
      throwCustomerConflict(error);
      throw error;
    }
  }

  async setDefaultAddress(
    organizationId: string,
    customerId: string,
    addressId: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await lockCustomer(transaction, organizationId, customerId);
      const address = await transaction.customerAddress.findFirst({
        where: {
          active: true,
          customerId,
          id: addressId,
          organizationId,
        },
        select: { id: true },
      });
      if (!address) {
        throw new NotFoundException('Active customer address not found');
      }
      await transaction.customerAddress.updateMany({
        where: { customerId, isDefault: true, organizationId },
        data: { isDefault: false },
      });
      return transaction.customerAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
      });
    });
  }
}

async function lockCustomer(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  customerId: string,
) {
  const [customer] = await transaction.$queryRaw<LockedCustomer[]>(Prisma.sql`
    SELECT "id", "organizationId", "name", "active"
    FROM "Customer"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${customerId}
    FOR UPDATE
  `);
  if (!customer) throw new NotFoundException('Customer not found');
  return customer;
}

function normalizeOptionalText(value: string | undefined) {
  return value?.trim() || null;
}

function normalizeRequiredText(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new BadRequestException(`${field} must not be blank`);
  return normalized;
}

function normalizeNullableText(value: string | null) {
  return value?.trim() || null;
}

function throwCustomerConflict(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException(
      'Customer email, phone, RUT or address label is already in use',
    );
  }
}
