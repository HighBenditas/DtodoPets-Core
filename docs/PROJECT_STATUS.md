# Estado del proyecto

Actualizado: 2026-08-22.

## Estado actual

DTodoPets Core tiene un backend NestJS 11 funcional con Prisma 7 y un primer
dominio `Organization`. PostgreSQL y Redis funcionan en Docker. El proyecto aún
no tiene autenticación, autorización, aislamiento multi-tenant efectivo ni los
dominios comerciales posteriores.

## Último hito completado

FASE 1 — Foundation.

## Hito actual

FASE 2 — Identity & Organizations: usuario, sesiones, roles, permisos,
autenticación y aislamiento por organización.

## Próximo hito

FASE 3 — Locations & Catalog.

## Funcionalidades terminadas

- Docker Compose con PostgreSQL 18 y Redis 8, ambos saludables.
- Prisma 7 configurado con adapter PostgreSQL.
- Modelo y CRUD inicial de `Organization`.
- Migración `20260817231441_init_organization` aplicada.
- Pruebas unitarias de creación de organizaciones y prueba e2e inicial.
- API versionada bajo `/api/v1`, validación global y errores consistentes.
- Health check de PostgreSQL en `GET /health`.
- Helmet, CORS configurable y correlation ID por request.
- Ejemplos de entorno sin secretos y scripts de calidad reproducibles.
- Compilación, typecheck, lint, 9 unit tests y 3 e2e correctos.

## Funcionalidades pendientes

- Identity & Access, RBAC y sesiones.
- Sucursales/bodegas, catálogo, inventario, clientes y pedidos.
- Pagos, logística, canales, integraciones, promociones y devoluciones.
- Reportes, auditoría, eventos, webhooks, frontend y hardening de producción.

## Problemas conocidos

- El CRUD actual de organizaciones no está autenticado ni aislado por tenant.
- No hay seed; se implementará junto con roles y el administrador de desarrollo.
- `npm audit --omit=dev` informa tres vulnerabilidades altas transitivas por
  `deepmerge-ts` dentro de la CLI Prisma. La corrección automática propone
  degradar Prisma 7 a Prisma 6 y no debe aplicarse sin una migración evaluada.
- No hay frontend ni pipeline CI.

## Decisiones tomadas

- Mantener NestJS, PostgreSQL y Prisma.
- Evolucionar como monolito modular antes de considerar servicios separados.
- Usar `Organization` como límite de tenant y derivar el tenant de la sesión.
- No editar ni eliminar la migración aplicada.
- Mantener el cliente Prisma generado fuera de Git y ESLint.

## Migraciones actuales

| Migración | Estado | Contenido |
| --- | --- | --- |
| `20260817231441_init_organization` | Aplicada | Tabla e índice único de `Organization` |

La base contiene cero organizaciones al momento de la auditoría.

## Comandos útiles

```bash
docker compose up -d
docker compose ps
cd backend
npm run prisma:validate
npm run prisma:generate
npx prisma migrate status
npm run lint
npm run typecheck
npm test -- --runInBand
npm run build
```

## Cómo continuar el desarrollo

Lee `AGENTS.md` y `docs/ROADMAP.md`, comprueba un worktree limpio, completa el
hito actual y ejecuta toda la validación obligatoria antes de actualizar estos
documentos.

## NEXT ACTION

Implementar Identity & Access con una migración progresiva que agregue usuarios,
sesiones, roles y permisos multi-tenant; proteger el dominio Organization.
