import { Prisma } from '../generated/prisma/client';

export const PERMISSIONS = {
  customersCreate: 'customers.create',
  customersRead: 'customers.read',
  customersUpdate: 'customers.update',
  integrationsManage: 'integrations.manage',
  inventoryAdjust: 'inventory.adjust',
  inventoryRead: 'inventory.read',
  ordersCreate: 'orders.create',
  ordersRead: 'orders.read',
  ordersUpdate: 'orders.update',
  locationsManage: 'locations.manage',
  locationsRead: 'locations.read',
  organizationsRead: 'organizations.read',
  organizationsUpdate: 'organizations.update',
  productsCreate: 'products.create',
  productsDelete: 'products.delete',
  productsRead: 'products.read',
  productsUpdate: 'products.update',
  reportsRead: 'reports.read',
  usersManage: 'users.manage',
  warehousesManage: 'warehouses.manage',
  warehousesRead: 'warehouses.read',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const allPermissions = Object.values(PERMISSIONS);

export const DEFAULT_ROLES: ReadonlyArray<{
  description: string;
  key: string;
  name: string;
  permissions: readonly PermissionKey[];
}> = [
  {
    description: 'Control total de la organización',
    key: 'owner',
    name: 'Owner',
    permissions: allPermissions,
  },
  {
    description: 'Administración operativa completa',
    key: 'admin',
    name: 'Admin',
    permissions: allPermissions,
  },
  {
    description: 'Gestión comercial y operativa',
    key: 'manager',
    name: 'Manager',
    permissions: allPermissions.filter(
      (permission) =>
        permission !== PERMISSIONS.usersManage &&
        permission !== PERMISSIONS.integrationsManage &&
        permission !== PERMISSIONS.organizationsUpdate,
    ),
  },
  {
    description: 'Ventas y gestión de clientes',
    key: 'seller',
    name: 'Seller',
    permissions: [
      PERMISSIONS.customersCreate,
      PERMISSIONS.customersRead,
      PERMISSIONS.customersUpdate,
      PERMISSIONS.inventoryRead,
      PERMISSIONS.locationsRead,
      PERMISSIONS.ordersCreate,
      PERMISSIONS.ordersRead,
      PERMISSIONS.ordersUpdate,
      PERMISSIONS.productsRead,
    ],
  },
  {
    description: 'Operaciones de bodega e inventario',
    key: 'warehouse',
    name: 'Warehouse',
    permissions: [
      PERMISSIONS.inventoryAdjust,
      PERMISSIONS.inventoryRead,
      PERMISSIONS.locationsRead,
      PERMISSIONS.ordersRead,
      PERMISSIONS.ordersUpdate,
      PERMISSIONS.productsRead,
      PERMISSIONS.warehousesRead,
    ],
  },
  {
    description: 'Acceso de solo lectura',
    key: 'viewer',
    name: 'Viewer',
    permissions: [
      PERMISSIONS.customersRead,
      PERMISSIONS.inventoryRead,
      PERMISSIONS.locationsRead,
      PERMISSIONS.ordersRead,
      PERMISSIONS.organizationsRead,
      PERMISSIONS.productsRead,
      PERMISSIONS.reportsRead,
      PERMISSIONS.warehousesRead,
    ],
  },
];

export async function provisionDefaultRbac(
  prisma: Prisma.TransactionClient,
  organizationId: string,
) {
  await prisma.permission.createMany({
    data: allPermissions.map((key) => ({ key })),
    skipDuplicates: true,
  });
  const permissions = await prisma.permission.findMany({
    where: { key: { in: allPermissions } },
  });
  const permissionIds = new Map(
    permissions.map((permission) => [permission.key, permission.id]),
  );
  const roleIds = new Map<string, string>();

  for (const definition of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: {
        organizationId_key: {
          key: definition.key,
          organizationId,
        },
      },
      create: {
        description: definition.description,
        key: definition.key,
        name: definition.name,
        organizationId,
        system: true,
      },
      update: {
        description: definition.description,
        name: definition.name,
        system: true,
      },
    });
    roleIds.set(definition.key, role.id);

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: definition.permissions.map((permissionKey) => ({
        permissionId: getPermissionId(permissionIds, permissionKey),
        roleId: role.id,
      })),
      skipDuplicates: true,
    });
  }

  return roleIds;
}

function getPermissionId(
  permissionIds: Map<string, string>,
  permissionKey: PermissionKey,
) {
  const permissionId = permissionIds.get(permissionKey);

  if (!permissionId) {
    throw new Error(`Permission was not provisioned: ${permissionKey}`);
  }

  return permissionId;
}
