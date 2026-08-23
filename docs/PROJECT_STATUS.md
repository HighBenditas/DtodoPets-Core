# Estado del proyecto

Actualizado: 2026-08-22.

## Estado actual

DTodoPets Core tiene un backend NestJS 11 con Prisma 7, foundation HTTP,
Identity & Access, sucursales/bodegas, catálogo, inventario, clientes, pedidos,
pagos, devoluciones, logística, canales e integraciones multi-tenant. PostgreSQL
y Redis funcionan en Docker. El adaptador inicial de Mercado Libre ya mapea
variantes, importa pedidos y valida el origen de webhooks. El siguiente dominio es
Storefront & Promotions; aún no existe frontend.

## Último hito completado

FASE 10 — Mercado Libre.

## Hito actual

FASE 11 — Storefront & Promotions.

## Próximo hito

FASE 12 — Analytics & Audit.

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
- Usuarios activos/inactivos, sesiones, login, refresh rotativo, logout, perfil y
  cambio de contraseña con revocación de otras sesiones.
- Contraseñas hasheadas con scrypt y refresh tokens almacenados solo como SHA-256.
- RBAC persistido, seis roles de sistema y roles personalizados por tenant.
- Guards globales de JWT/permisos y organizaciones limitadas a la sesión.
- Seed local idempotente para organización, roles y Owner ficticio.
- Compilación, typecheck, lint, 28 unit tests y 6 e2e correctos.
- Smoke test real de bootstrap, login, tenant, creación de Seller, refresh y
  logout contra PostgreSQL.
- Sucursales y bodegas multi-tenant con relación compuesta protegida por FK,
  búsqueda, filtro de estado y paginación.
- Seed/smoke HTTP de sucursal y bodega aprobado; 34 unit tests y 6 e2e.
- Marcas, categorías jerárquicas, productos, variantes e imágenes multi-tenant.
- SKU y código de barras únicos por organización, precios CLP exactos y
  constraints PostgreSQL para importes, ofertas, peso y orden de imágenes.
- Catálogo paginado con búsqueda/filtros, creación atómica y desactivación
  lógica; seed idempotente con producto demostrativo.
- 46 unit tests en 16 suites y 6 e2e correctos; smoke HTTP autenticado del
  catálogo aprobado contra PostgreSQL.
- Saldo físico/reservado/disponible por bodega y variante, con constraints
  anti-negativos y relaciones compuestas por tenant.
- Ledger de movimientos append-only con actor, motivo, referencia, operación y
  snapshots antes/después; trigger PostgreSQL bloquea UPDATE/DELETE.
- Ajustes, transferencias, reservas y liberaciones transaccionales con bloqueo
  de filas ordenado, permisos separados e idempotencia por referencia.
- 52 unit tests en 17 suites y 6 e2e correctos; smoke concurrente real aprobó
  10 reservas sobre 100 unidades y rechazó otras 2 con HTTP 409.
- Clientes multi-tenant paginados con correo, teléfono chileno y RUT
  normalizados/únicos, búsqueda y desactivación lógica.
- Múltiples direcciones por cliente con un solo default activo, selección y
  promoción transaccionales bajo lock del cliente.
- 65 unit tests en 19 suites y 6 e2e correctos; smoke HTTP real aprobó
  normalización, duplicado 409, RUT inválido 400 y ciclo de direcciones default.
- Pedidos multi-tenant paginados con items, dirección y datos comerciales
  históricos; importes CLP exactos calculados en servidor.
- Creación `PENDING` reserva inventario en la misma transacción; confirmación
  consume físico/reservado y cancelación libera reservas bajo locks de fila.
- Historial de estados append-only, transiciones con motivo y reintentos de
  confirmación/cancelación idempotentes.
- El detalle de cliente proyecta conteos por estado y gasto confirmado/completado.
- 72 unit tests en 20 suites y 6 e2e correctos; smoke HTTP real aprobó creación,
  confirmación, cancelación, replays idempotentes y stock insuficiente 409.
- Pagos capturados separados del pedido, múltiples por venta y limitados al
  saldo neto pendiente bajo lock del pedido.
- Reembolsos parciales/completos limitados al pago original; estados
  `CAPTURED`, `PARTIALLY_REFUNDED` y `REFUNDED` actualizados atómicamente.
- Idempotencia con clave única y huella SHA-256 canónica: el mismo payload se
  reproduce y una reutilización distinta responde 409.
- Devoluciones parciales acumulables por item, con reintegro de stock opcional y
  movimiento `RETURN` append-only cuando corresponde.
- 81 unit tests en 22 suites y 6 e2e correctos; smoke HTTP real aprobó dos pagos,
  sobrecobro 409, reembolsos, replays y devoluciones con/sin reintegro.
- Shipments multi-tenant fraccionables por item para retiro, despacho propio,
  marketplace y courier externo.
- Cobro logístico asignado limitado al envío cobrado en el pedido; costo real
  separado con proyecciones exactas de subsidio y margen.
- Estados `PENDING`/`READY`/`IN_TRANSIT`/`DELIVERED`/`CANCELLED`, timestamps,
  tracking e historial append-only con actor y snapshots logísticos.
- Cancelar libera cantidades/cobro para un reemplazo; locks del pedido evitan
  sobreasignación concurrente e idempotencia protege la creación.
- 87 unit tests en 23 suites y 6 e2e correctos; smoke HTTP real aprobó cuatro
  shipments, tracking/costo obligatorios, subsidio/margen y cancelación.
- Canales e integraciones con credenciales AES-256-GCM, referencias externas,
  webhooks idempotentes por huella SHA-256 y outbox transaccional.
- 89 unit tests en 24 suites; smoke real confirmó secretos no expuestos,
  replays seguros, conflicto 409 y cuatro eventos internos.
- `MercadoLibreListing` mapea cada variante a item/variación externa y conserva
  snapshots exactos CLP de precio/comisión, disponibilidad y metadatos.
- Pedidos importados quedan ligados a integración/ID externo único y huella
  canónica; un replay no vuelve a reservar y un payload distinto responde 409.
- El webhook público exige origen, aplicación y vendedor configurados, deduplica
  por evento/huella y persiste recibo más evento outbox atómicamente.
- Reintentos concurrentes de orden/webhook se recuperan desde constraints
  únicas; referencias/eventos faltantes se reparan sin duplicar el evento.
- 96 unit tests en 25 suites y 6 e2e correctos; smoke HTTP real de Mercado Libre
  aprobó mapping, CLP, reserva única, conflictos, allowlist y eventos internos.

## Funcionalidades pendientes

- Promociones, catálogo público, carrito y checkout de storefront.
- Workers de outbox, reportes, auditoría, frontend y hardening de producción.

## Problemas conocidos

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
- Access tokens JWT de 15 minutos y refresh tokens opacos, rotativos, hasheados y
  respaldados por sesiones revocables.
- Roles y permisos se resuelven desde PostgreSQL en cada request autenticada;
  los nombres Owner/Admin/etc. solo son defaults provisionados.
- Inventario usa saldo materializado y ledger inmutable; las mutaciones bloquean
  filas con `FOR UPDATE` y las transferencias adquieren locks en orden estable.
- Pedidos preservan snapshots de cliente, dirección, SKU, nombre y precio; sus
  transiciones de inventario e historial son parte de la misma transacción.
- Pagos, reembolsos y devoluciones son entidades separadas; serializan por
  pedido y usan claves idempotentes con una huella del payload normalizado.
- Shipments asignan cantidades y cobro del pedido bajo lock; costo real y cobro
  al cliente permanecen separados para medir subsidio/margen.
- Credenciales de integración se cifran con AES-256-GCM y contexto tenant/key;
  referencias, recibos webhook y outbox se persisten antes de adaptar proveedores.
- Mercado Libre usa IDs externos estables y huellas canónicas persistidas para
  no duplicar pedidos ni inventario; el origen se valida antes de persistir.
- `@Public()` omite tanto JWT como permisos heredados; las rutas administrativas
  siguen denegadas por defecto y requieren `integrations.manage`.

## Migraciones actuales

| Migración | Estado | Contenido |
| --- | --- | --- |
| `20260817231441_init_organization` | Aplicada | Tabla e índice único de `Organization` |
| `20260822213602_add_identity_access` | Aplicada | Usuarios, sesiones, roles y permisos |
| `20260822220140_add_locations_warehouses` | Aplicada | Sucursales y bodegas multi-tenant |
| `20260822221117_add_catalog` | Aplicada | Marcas, categorías, productos, variantes e imágenes |
| `20260822223000_add_inventory` | Aplicada | Saldos, ledger, reservas, constraints y trigger append-only |
| `20260822230000_add_customers` | Aplicada | Clientes, direcciones, unicidades e índice de default activo |
| `20260822233000_extend_inventory_for_orders` | Aplicada | Estados `CONSUMED` y movimiento `COMMIT` para confirmar pedidos |
| `20260822233100_add_orders` | Aplicada | Pedidos, items, snapshots, totales e historial de estados |
| `20260822234000_extend_inventory_for_returns` | Aplicada | Movimiento `RETURN` para reintegros trazables |
| `20260822234100_add_payments_returns` | Aplicada | Pagos, reembolsos, devoluciones, idempotencia y constraints CLP |
| `20260822234617_add_logistics` | Aplicada | Shipments, items, costos, tracking, estados e historial |
| `20260823000202_add_sales_channels_integrations` | Aplicada | Canales, secretos cifrados, referencias, webhooks y outbox |
| `20260823002000_add_mercado_libre` | Aplicada | Mapping de listings y origen externo único de pedidos |
| `20260823002100_add_order_source_request_hash` | Aplicada | Huella canónica obligatoria para pedidos externos |
| `20260823002200_fix_order_source_pair_constraint` | Aplicada | Trío de origen externo explícitamente completo o nulo |

La base local contiene datos ficticios de desarrollo creados durante los smoke
tests: una organización, dos usuarios, seis roles, treinta y un permisos, una
sucursal, tres bodegas, una marca, una categoría, un producto, una variante, una
imagen, dos saldos de inventario y movimientos/reservas liberadas del smoke.
También contiene un cliente ficticio con dos direcciones y dos pedidos del
smoke de Orders: uno confirmado y otro cancelado. El confirmado tiene dos pagos,
dos reembolsos y dos devoluciones ficticias; solo una reintegró stock. Otro
pedido confirmado contiene cuatro shipments Logistics (uno cancelado).
El smoke de integraciones agregó un canal, una integración, una referencia, un
recibo webhook y cuatro eventos outbox ficticios.
Los dos recorridos locales de Mercado Libre agregaron dos canales,
integraciones, mappings y pedidos `PENDING` ficticios; el segundo completó un
recibo webhook y los eventos de listing, importación y webhook. Las pruebas finales
agregaron dos recibos con contrato real y origen local permitido. El primer flujo se
detuvo al detectar el antiguo 403 del guard público y se conservó para no borrar
datos ni reservas existentes.

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

Implementar Storefront & Promotions: separar un contrato público de catálogo y
disponibilidad, modelar promociones auditables y preparar carrito/checkout sin
exponer costos, secretos ni superficies administrativas.
