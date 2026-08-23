# DTodoPets Core

DTodoPets Core será la fuente central de verdad para ventas y operaciones de
DTodoPets. El proyecto evoluciona como un monolito modular: una API NestJS sirve
los dominios del negocio y PostgreSQL mantiene los datos transaccionales. Redis
queda disponible para capacidades que lo necesiten más adelante.

## Estado actual

Foundation, Identity, Locations, Catalog, Inventory, Customers y Orders están
implementados, junto con pagos, devoluciones y logística fraccionable. El
detalle de cliente proyecta historial y gasto desde pedidos
confirmados/completados. El hito activo es Mercado Libre. Consulta
[el estado del proyecto](docs/PROJECT_STATUS.md) y
[el roadmap](docs/ROADMAP.md) antes de comenzar una tarea.

## Stack

- Node.js 24 y npm
- NestJS 11 con TypeScript estricto
- PostgreSQL 18 y Redis 8 mediante Docker Compose
- Prisma ORM 7 con driver adapter de PostgreSQL
- Jest y Supertest

No existe frontend todavía. Se prioriza una base de backend segura antes del
panel administrativo y storefront.

## Requisitos

- Node.js 24 o una versión compatible con las dependencias fijadas
- npm
- Docker Desktop con Docker Compose v2

## Instalación

```bash
git clone <repository-url> dtodopets-core
cd dtodopets-core
copy .env.example .env
copy backend\.env.example backend\.env
cd backend
npm ci
npm run prisma:generate
```

En macOS/Linux sustituye `copy` por `cp`. Los ejemplos contienen únicamente
valores locales ficticios; cambia todas las credenciales en otros entornos.

## Infraestructura local

Desde la raíz:

```bash
docker compose up -d
docker compose ps
docker compose logs
docker compose down
```

Los puertos se publican solo en `127.0.0.1`.

## Base de datos

Desde `backend/`:

```bash
npm run prisma:validate
npm run prisma:generate
npm run prisma:deploy
```

Durante el desarrollo de un nuevo cambio de esquema se utiliza
`npx prisma migrate dev --name <nombre_descriptivo>`. Nunca uses
`prisma migrate reset` sobre una base con datos útiles.

## Seed de desarrollo

```bash
cd backend
npm run prisma:seed
```

El seed es idempotente y crea la organización, permisos, seis roles de sistema,
el Owner local, una sucursal, una bodega y un producto de catálogo ficticios.
Los valores predeterminados son `admin@dtodopets.local` /
`Change-this-development-password-123!`; son
credenciales exclusivamente locales y deben sobrescribirse mediante las
variables `SEED_*` descritas en `backend/.env.example`.

## Ejecutar el backend

```bash
cd backend
npm run start:dev
```

La API escucha por defecto en `http://localhost:3000`. Los endpoints de negocio
se versionan bajo `/api/v1` a medida que se completa la foundation.

## Calidad y tests

```bash
npm run format
npm run lint
npm run typecheck
npm test -- --runInBand
npm run test:e2e
npm run build
```

## Estructura

```text
dtodopets-core/
├── backend/            API NestJS, Prisma y tests
├── docs/               Arquitectura, estado y reglas del negocio
├── docker-compose.yml  PostgreSQL y Redis locales
├── AGENTS.md           Reglas para agentes y colaboradores
└── README.md
```

Consulta [DEVELOPMENT.md](docs/DEVELOPMENT.md) para convenciones y migraciones,
y [TESTING.md](docs/TESTING.md) para la estrategia de pruebas.
