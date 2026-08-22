# Pruebas

## Estado inicial

- Tres unit tests de `OrganizationsService`.
- Un unit test del controller raíz.
- Un e2e del endpoint raíz con Prisma reemplazado por mock.
- No hay integration tests reales contra PostgreSQL.

## Estrategia

- Unit: normalización, reglas monetarias, estados, permisos y errores.
- Integration: constraints, transacciones, aislamiento y concurrencia en una base
  de test separada.
- E2E: contratos HTTP principales desde autenticación hasta efectos persistidos.

Nunca ejecutes tests destructivos contra la base local útil. Los integration/e2e
con persistencia deberán exigir `DATABASE_URL_TEST` y rechazar una URL que no
identifique explícitamente un entorno de test.

## Matriz mínima progresiva

- Autenticación, refresh/logout y usuarios inactivos.
- Permisos y aislamiento entre organizaciones.
- CRUD de catálogo con validación/paginación.
- Ajustes/reservas y falta de stock.
- Creación y cancelación atómica de pedidos.
- Pagos, devoluciones e idempotencia.

## Comandos

```bash
npm test -- --runInBand
npm run test:e2e
npm run test:cov
```
