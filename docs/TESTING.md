# Pruebas

## Estado actual

- 52 unit tests en 17 suites para configuración, health, Organization, password,
  login/sesiones, permisos, usuarios, roles, sucursales, bodegas, catálogo e
  inventario.
- 6 e2e para rutas públicas, validación, autenticación, tenant y permisos.
- Smoke test manual real aprobado contra PostgreSQL para bootstrap → RBAC →
  refresh rotativo → logout.
- Smoke HTTP real de sucursales/bodegas, paginación y validación aprobado.
- Smoke HTTP real autenticado de marcas/categorías/productos aprobado: búsqueda
  por SKU, precio CLP serializado exactamente, 401 sin token y 400 para
  paginación inválida.
- Seed de catálogo ejecutado dos veces; PostgreSQL conservó un único registro de
  marca, categoría, producto, variante e imagen.
- Smoke concurrente real de inventario: 12 reservas simultáneas de 10 unidades
  sobre 100 disponibles produjeron 10 éxitos y 2 conflictos 409; luego 10
  liberaciones dejaron reservado en cero.
- Replay de reserva/liberación idempotente, transferencia 80/20, reducción sin
  stock 409 y trigger append-only de PostgreSQL verificados.
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
