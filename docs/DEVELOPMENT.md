# Desarrollo

## Preparación

Sigue el quickstart de `README.md`. Trabaja desde la raíz Git
`dtodopets-core/`; los comandos npm y Prisma se ejecutan desde `backend/`.
El Admin Web se trabaja desde `frontend/`; para desarrollo cruzado configura
`CORS_ORIGINS=http://localhost:5173` en `backend/.env`.

## Convenciones

- Un módulo NestJS por dominio, con controller, DTOs, servicio y tests cercanos.
- DTOs validan toda entrada externa; no se usan interfaces TypeScript como
  sustituto de validación runtime.
- Servicios reciben el tenant desde el contexto autenticado.
- Nombres y código en inglés; documentación de negocio puede estar en español.
- Imports relativos coherentes y sin dependencias circulares.
- Commits lógicos con migración, código, tests y documentación relacionados.

## Prisma y migraciones

1. Modifica `backend/prisma/schema.prisma`.
2. Ejecuta `npx prisma format` y `npm run prisma:validate`.
3. Crea una migración pequeña: `npx prisma migrate dev --name <nombre>`.
4. Revisa el SQL generado antes de continuar.
5. Ejecuta `npm run prisma:generate` y los tests.

No reescribas migraciones aplicadas. En producción se usa
`npm run prisma:deploy`, no `migrate dev`.

## Seed

`npm run prisma:seed` es explícito, idempotente y está bloqueado en
`NODE_ENV=production`. Configura los valores ficticios con variables `SEED_*`.
No cambies contraseñas existentes al volver a ejecutar un seed.

## Agregar un endpoint

1. Define el permiso y regla multi-tenant.
2. Crea DTOs con validación runtime.
3. Implementa la regla en el servicio, no en el controller.
4. Mapea errores esperables a códigos HTTP correctos.
5. Agrega unit tests y e2e según el riesgo.
6. Actualiza `docs/API.md` y reglas afectadas.

## Validación antes de entregar

```bash
npm run prisma:validate
npm run prisma:generate
npm run lint
npm run typecheck
npm test -- --runInBand
npm run test:e2e
npm run build

cd ../frontend
npm run check
npm run build
```
