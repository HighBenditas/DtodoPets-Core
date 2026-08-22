# DTodoPets Core — instrucciones para agentes

Lee, en este orden, `README.md`, `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`,
`docs/ARCHITECTURE.md` y `docs/BUSINESS_RULES.md` antes de modificar código.

## Alcance y arquitectura

- El repositorio contiene un monolito modular NestJS en `backend/`.
- PostgreSQL y Redis se ejecutan con `docker-compose.yml`.
- Prisma es la fuente de verdad del modelo relacional; no edites migraciones ya
  aplicadas ni uses `prisma migrate reset`.
- `Organization` es el límite de tenant. Todo dato de negocio debe filtrarse con
  un `organizationId` obtenido de la identidad autenticada, nunca confiando en el
  cuerpo o query enviados por el cliente.
- Mantén separados los dominios. No agregues microservicios, CQRS o mensajería
  externa sin una necesidad medida.

## Comandos

Ejecutar desde `backend/`:

```bash
npm ci
npm run prisma:validate
npm run prisma:generate
npm run lint
npm run typecheck
npm test -- --runInBand
npm run test:e2e
npm run build
```

Infraestructura desde la raíz:

```bash
docker compose up -d
docker compose ps
docker compose logs
```

## Reglas que no deben romperse

- No confirmes `.env`, secretos, tokens, `node_modules`, datos o backups.
- No uses `float` para dinero; usa `Decimal` o unidades monetarias mínimas.
- No permitas stock negativo accidental ni movimientos sin trazabilidad.
- Pedidos, pagos, webhooks e integraciones deben ser idempotentes donde aplique.
- No edites `backend/src/generated/prisma`; se regenera con Prisma.
- No ocultes errores con `any`, `@ts-ignore` o desactivando tests.
- Conserva compatibilidad con migraciones aplicadas y usa transacciones para
  cambios atómicos de pedidos, pagos e inventario.

## Definición de terminado

Una funcionalidad requiere modelo/migración cuando corresponda, servicio,
endpoint, autorización, validación, manejo de errores, tests y documentación.
Antes de cerrar un hito ejecuta Prisma format/validate/generate, lint, typecheck,
tests y build. Actualiza `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md` y
`CHANGELOG.md`, incluyendo una `NEXT ACTION` concreta.
