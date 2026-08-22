# Base de datos

## Estado real

PostgreSQL 18 contiene actualmente dos tablas: `Organization` y
`_prisma_migrations`. La única migración aplicada es
`20260817231441_init_organization`.

```mermaid
erDiagram
  Organization {
    string id PK
    string name
    string slug UK
    boolean active
    datetime createdAt
    datetime updatedAt
  }
```

## Organization

- `id`: UUID textual generado por Prisma.
- `slug`: único global en el estado actual.
- `active`: desactivación lógica disponible para reglas futuras.
- `createdAt`/`updatedAt`: timestamps administrados por Prisma/PostgreSQL.

## Estrategia multi-tenant

Las futuras tablas de negocio llevarán `organizationId` con foreign key e
índice. Unicidades naturales como email, SKU o nombres de rol serán compuestas
con `organizationId` salvo que el dato sea global por diseño.

## Estrategia prevista

- Dinero CLP: `Decimal` con precisión explícita o entero en pesos, definido por
  dominio; nunca `Float`.
- Inventario: saldo por bodega/variante más ledger de movimientos auditable.
- Pedidos: items conservan snapshots comerciales y no dependen del precio actual.
- Pagos y envíos: entidades separadas del pedido.
- Integraciones: constraints de idempotencia por canal/proveedor y referencia.

Las secciones previstas no representan tablas implementadas todavía. Cada hito
actualizará este documento junto con `schema.prisma`.
