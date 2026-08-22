import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CustomersService } from './customers.service';

function transactionMock() {
  return {
    $queryRaw: jest.fn(),
    customerAddress: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
}

describe('CustomersService', () => {
  let service: CustomersService;
  let prisma: {
    $transaction: jest.Mock;
    customer: {
      count: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    customerAddress: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      customer: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      customerAddress: { findMany: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(CustomersService);
  });

  it('does not expose a customer from another tenant', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);

    await expect(service.findOne('org-a', 'customer-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'customer-b', organizationId: 'org-a' },
      }),
    );
  });

  it('normalizes customer identity before storing it in the tenant', async () => {
    prisma.customer.create.mockResolvedValue({ id: 'customer-a' });

    await service.create('org-a', {
      email: ' CLIENTE@Example.com ',
      name: ' Cliente Demo ',
      phone: '+56 9 1234 5678',
      rut: '12.345.678-5',
    });

    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          active: true,
          email: 'cliente@example.com',
          name: 'Cliente Demo',
          notes: null,
          organizationId: 'org-a',
          phone: '+56912345678',
          rut: '12345678-5',
        },
      }),
    );
  });

  it('rejects a blank customer name before reaching PostgreSQL', async () => {
    await expect(
      service.create('org-a', { name: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.customer.create).not.toHaveBeenCalled();
  });

  it('makes the first active address default and inherits the customer name', async () => {
    const transaction = transactionMock();
    transaction.$queryRaw.mockResolvedValue([
      {
        active: true,
        id: 'customer-a',
        name: 'Cliente Demo',
        organizationId: 'org-a',
      },
    ]);
    transaction.customerAddress.count.mockResolvedValue(0);
    transaction.customerAddress.create.mockResolvedValue({ id: 'address-a' });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    await service.createAddress('org-a', 'customer-a', {
      addressLine1: ' Av. Siempre Viva 123 ',
      city: ' Santiago ',
      commune: ' Providencia ',
      label: ' Casa ',
      phone: '9 1234 5678',
      region: ' Metropolitana ',
    });

    expect(transaction.customerAddress.create).toHaveBeenCalledWith({
      data: {
        active: true,
        addressLine1: 'Av. Siempre Viva 123',
        addressLine2: null,
        city: 'Santiago',
        commune: 'Providencia',
        customerId: 'customer-a',
        instructions: null,
        isDefault: true,
        label: 'Casa',
        organizationId: 'org-a',
        phone: '+56912345678',
        postalCode: null,
        recipientName: 'Cliente Demo',
        region: 'Metropolitana',
      },
    });
  });

  it('promotes another address when the default is deactivated', async () => {
    const transaction = transactionMock();
    transaction.$queryRaw.mockResolvedValue([
      {
        active: true,
        id: 'customer-a',
        name: 'Cliente Demo',
        organizationId: 'org-a',
      },
    ]);
    transaction.customerAddress.findFirst
      .mockResolvedValueOnce({
        active: true,
        id: 'address-a',
        isDefault: true,
      })
      .mockResolvedValueOnce({ id: 'address-b' });
    transaction.customerAddress.update
      .mockResolvedValueOnce({ id: 'address-a' })
      .mockResolvedValueOnce({ id: 'address-b' });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    await service.updateAddress('org-a', 'customer-a', 'address-a', {
      active: false,
    });

    expect(transaction.customerAddress.update).toHaveBeenNthCalledWith(1, {
      data: { active: false, isDefault: false },
      where: { id: 'address-a' },
    });
    expect(transaction.customerAddress.update).toHaveBeenNthCalledWith(2, {
      data: { isDefault: true },
      where: { id: 'address-b' },
    });
  });

  it('scopes default-address selection to the customer and tenant', async () => {
    const transaction = transactionMock();
    transaction.$queryRaw.mockResolvedValue([
      {
        active: true,
        id: 'customer-a',
        name: 'Cliente Demo',
        organizationId: 'org-a',
      },
    ]);
    transaction.customerAddress.findFirst.mockResolvedValue({
      id: 'address-a',
    });
    transaction.customerAddress.update.mockResolvedValue({
      id: 'address-a',
      isDefault: true,
    });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    await service.setDefaultAddress('org-a', 'customer-a', 'address-a');

    expect(transaction.customerAddress.findFirst).toHaveBeenCalledWith({
      where: {
        active: true,
        customerId: 'customer-a',
        id: 'address-a',
        organizationId: 'org-a',
      },
      select: { id: true },
    });
  });
});
