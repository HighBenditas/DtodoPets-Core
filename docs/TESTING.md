# Pruebas

## Estado actual

- 87 unit tests en 23 suites para configuración, health, Organization, password,
  login/sesiones, permisos, usuarios, roles, sucursales, bodegas, catálogo,
  inventario, clientes, pedidos, pagos, devoluciones y shipments.
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
- Smoke HTTP real de Customers: identidad chilena normalizada, duplicado 409,
  RUT inválido 400, búsqueda y transición/promoción de dirección default.
- Smoke HTTP real de Orders: totales CLP y reserva al crear, consumo al confirmar,
  liberación al cancelar, replays idempotentes, historial/proyección de cliente y
  rechazo 409 por stock insuficiente.
- Smoke HTTP real de Payments & Returns: dos pagos exactos, sobrecobro 409,
  reembolso parcial/completo, replays y conflictos de huella, límite de cantidad
  devuelta y un único reintegro `RETURN` de stock 78 → 79.
- Smoke HTTP real de Logistics: pedido de tres unidades, cuatro shipments (uno
  cancelado/reemplazado), sobreasignaciones 409, tracking/costo obligatorios,
  subsidio $400, margen $50 e inventario sin cambios durante fulfillment.
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
- Creación, confirmación y cancelación atómica de pedidos.
- Canales, referencias externas, webhooks e idempotencia de integraciones.

## Comandos

```bash
npm test -- --runInBand
npm run test:e2e
npm run test:cov
```
