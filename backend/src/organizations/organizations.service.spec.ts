import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: {
    organization: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      organization: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
  });

  it('creates an organization with a normalized slug', async () => {
    const organization = {
      id: 'org-id',
      name: 'Mi Clinica',
      slug: 'mi-clinica',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.organization.create.mockResolvedValue(organization);

    await expect(service.create({ name: ' Mi Clinica ' })).resolves.toBe(
      organization,
    );
    expect(prisma.organization.create).toHaveBeenCalledWith({
      data: {
        name: 'Mi Clinica',
        slug: 'mi-clinica',
        active: true,
      },
    });
  });

  it('rejects empty organization names', async () => {
    await expect(service.create({ name: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('maps duplicate slugs to conflict responses', async () => {
    prisma.organization.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: Prisma.prismaVersion.client,
      }),
    );

    await expect(service.create({ name: 'Mi Clinica' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('filters organization lists using the authenticated tenant', async () => {
    prisma.organization.findMany.mockResolvedValue([]);
    await service.findAll('org-a');
    expect(prisma.organization.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      where: { id: 'org-a' },
    });
  });

  it('does not return another tenant organization', async () => {
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-b' });
    await expect(service.findOne('org-a', 'org-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
