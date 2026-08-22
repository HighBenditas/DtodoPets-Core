# Base de datos

## Estado real

PostgreSQL 18 contiene Foundation, Identity, Locations y Catalog. Hay cuatro
migraciones aplicadas, incluida `20260822221117_add_catalog`.

```mermaid
erDiagram
  Organization ||--o{ User : has
  Organization ||--o{ Role : defines
  Organization ||--o{ Location : owns
  Organization ||--o{ Warehouse : owns
  Organization ||--o{ Brand : owns
  Organization ||--o{ Category : owns
  Organization ||--o{ Product : owns
  Organization ||--o{ ProductVariant : owns
  Location ||--o{ Warehouse : contains
  Brand ||--o{ Product : labels
  Category ||--o{ Category : parent
  Category ||--o{ Product : classifies
  Product ||--|{ ProductVariant : offers
  Product ||--o{ ProductImage : displays
  User ||--o{ AuthSession : owns
  User ||--o{ UserRole : assigned
  Role ||--o{ UserRole : grants
  Role ||--o{ RolePermission : includes
  Permission ||--o{ RolePermission : maps
  Organization {
    string id PK
    string name
    string slug UK
    boolean active
    datetime createdAt
    datetime updatedAt
  }
  User {
    string id PK
    string organizationId FK
    string email
    string passwordHash
    boolean active
  }
  Role {
    string id PK
    string organizationId FK
    string key
    boolean system
  }
  Permission {
    string id PK
    string key UK
  }
  AuthSession {
    string id PK
    string userId FK
    string refreshTokenHash UK
    datetime expiresAt
    datetime revokedAt
  }
  Location {
    string id PK
    string organizationId FK
    string name
    boolean active
  }
  Warehouse {
    string id PK
    string organizationId FK
    string locationId FK
    string name
    boolean active
  }
  Brand {
    string id PK
    string organizationId FK
    string slug
    boolean active
  }
  Category {
    string id PK
    string organizationId FK
    string parentId FK
    string slug
  }
  Product {
    string id PK
    string organizationId FK
    string brandId FK
    string categoryId FK
    string slug
  }
  ProductVariant {
    string id PK
    string organizationId FK
    string productId FK
    string sku
    decimal priceAmount
  }
  ProductImage {
    string id PK
    string productId FK
    string url
    int sortOrder
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

`User.email` y `Role.key` son únicos dentro de una organización. `Permission`
es un catálogo global; las asignaciones pasan por `RolePermission`. Las queries
administrativas incluyen `organizationId` y los guards reconstruyen permisos
desde relaciones persistidas.

## Sesiones

`AuthSession` conserva únicamente SHA-256 del refresh token opaco, expiración,
revocación y último uso. Rotar actualiza el hash mediante un `updateMany`
condicional para que dos refresh simultáneos no puedan tener éxito.

## Sucursales y bodegas

Nombres son únicos por organización. La FK compuesta de `Warehouse(locationId,
organizationId)` a `Location(id, organizationId)` impide asociar físicamente una
bodega a una sucursal de otro tenant. `locationId` puede ser nulo para bodegas
sin sucursal.

## Catálogo

`Brand`, `Category`, `Product` y `ProductVariant` llevan `organizationId` e
índices compuestos. Las relaciones de producto con marca/categoría y de variante
con producto usan foreign keys compuestas con la organización, por lo que una
referencia entre tenants queda rechazada también en PostgreSQL. Las categorías
admiten jerarquía dentro del tenant; el servicio impide ciclos.

Los slugs de marca, categoría y producto, además de SKU/código de barras, son
únicos por organización. Una imagen es única por producto y URL. El borrado de
producto expuesto por la API es desactivación lógica.

Costos y precios se guardan como `Decimal(14,0)`: pesos CLP enteros, nunca
`Float`. Checks de base exigen importes no negativos, oferta no superior al
precio, peso positivo y orden de imagen no negativo.

## Estrategia prevista

- Dinero de los próximos dominios seguirá el patrón `Decimal(14,0)` ya aplicado
  al catálogo para pesos CLP exactos; nunca `Float`.
- Inventario: saldo por bodega/variante más ledger de movimientos auditable.
- Pedidos: items conservan snapshots comerciales y no dependen del precio actual.
- Pagos y envíos: entidades separadas del pedido.
- Integraciones: constraints de idempotencia por canal/proveedor y referencia.

Las secciones previstas no representan tablas implementadas todavía. Cada hito
actualizará este documento junto con `schema.prisma`.
