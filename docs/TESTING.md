# Pruebas

## Estado actual

Etapa 2A (2026-11-16) agrega doce pruebas contra PostgreSQL real en
`backend/test/pos.postgres-spec.ts`, separadas de las pruebas HTTP con mocks.
Requieren explícitamente `DATABASE_URL_TEST` apuntando a
`127.0.0.1:55432/dtodopets_stage1_test` y `NODE_ENV=test`; cualquier otro destino
se rechaza antes de crear la aplicación. No hacen reset, seed comercial ni
migraciones automáticas. Cada ejecución agrega fixtures sintéticos aislados por
organización y conserva la evidencia para diagnóstico.

Validación de esta entrega: 128 unit tests backend en 33 suites, 6 pruebas HTTP
con mocks, 12 con PostgreSQL real y 9 pruebas frontend. Lint, typecheck, build y
Prisma format/validate/generate aprobados. La persistencia se verificó después
de reiniciar únicamente la instancia PostgreSQL de pruebas.

Desde `backend/`, con la URL sintética inyectada solo al proceso:

```powershell
npm.cmd run test:postgres -- --no-cache
```

El comando incluye `--experimental-vm-modules` porque el compilador WASM de
Prisma 7 utiliza imports dinámicos dentro de Jest. No se reemplaza Prisma por
mocks. El reinicio controlado de PostgreSQL y las huellas de persistencia se
verificaron aparte en `../stage2a-validation-20261116/` (desde la raíz Git).
Ver `POS_STAGE2A.md` para el defecto, compatibilidad y limitaciones.

Los recuentos y smoke tests que siguen son el registro histórico anterior:

- 123 unit tests en 31 suites para configuración, health, Organization, password,
  login/sesiones, permisos, usuarios, roles, sucursales, bodegas, catálogo,
  inventario, clientes, pedidos, pagos, devoluciones, shipments, integraciones y
  Mercado Libre, promociones, storefront, auditoría y reportes.
- 6 e2e para rutas públicas, validación, autenticación, tenant y permisos.
- 6 tests de frontend en 2 suites para cliente HTTP, errores seguros, login,
  logout, restauración/rotación, sesión inválida y navegación por permisos.
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
- Smoke HTTP real de Integrations: ciphertext/secreto no expuestos, referencia y
  webhook reintentables, payload distinto 409 y cuatro eventos outbox.
- Smoke HTTP real de Mercado Libre: mapping con importes CLP exactos, orden con
  una sola reserva tras replay, ID/payload distinto 409, origen permitido 200 en
  20 ms, vendedor distinto 401 y eventos outbox de listing/orden/webhook.
- Smoke HTTP real de Storefront: catálogo sin costo/físico/reservado/bodega,
  token ausente o erróneo 404, cupón 10% exacto (1.499 CLP), checkout `PENDING`,
  una sola reserva/redención/evento, replay idéntico y payload cambiado 409.
- Smoke HTTP/PostgreSQL real de Audit: mutación exitosa/fallida, consulta por
  correlation ID, permiso/401, secreto ausente y trigger bloqueando UPDATE/DELETE.
- Smoke HTTP real de Reports: overview/daily 200, 401 sin token, rango excesivo
  400, `reports.read`, paginación y coincidencia de 2 ventas por 75.650 CLP.
- `EXPLAIN (ANALYZE, BUFFERS)` diario: 0,115 ms sobre seis pedidos; scan secuencial
  elegido por baja cardinalidad e índice compuesto existente, sin nueva migración.
- Smoke real del Admin Web: assets Vite `200`, preflight CORS `204`, login con 34
  permisos, rotación del refresh token, replay anterior `401` y logout `204`.
- La inspección visual en navegador quedó pendiente porque el controlador de
  navegador de Codex no pudo iniciar por falta de `sandboxPolicy`; no afecta las
  pruebas automatizadas, pero debe repetirse antes de cerrar la Fase 13.
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
- Catálogo público, token de carrito, promociones, checkout y replay sin doble
  orden/reserva/redención.

## Comandos

```bash
npm test -- --runInBand
npm run test:e2e
npm run test:cov
```

Desde `frontend/`:

```bash
npm run check
npm run build
```
