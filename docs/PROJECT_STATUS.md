# Estado del proyecto

Actualizado: 2026-08-22.

## Estado actual

DTodoPets Core tiene un backend NestJS 11 con Prisma 7, foundation HTTP,
Identity & Access, sucursales/bodegas, catálogo, inventario, clientes, pedidos,
pagos, devoluciones, logística, canales e integraciones multi-tenant. PostgreSQL
y Redis funcionan en Docker. Mercado Libre ya mapea/importa y el storefront
público ofrece catálogo, promociones, carrito y checkout idempotente sin
frontend. Analytics & Audit continúa activo: la auditoría administrativa ya es
operativa y todavía faltan los KPIs y reportes.

## Último hito completado

FASE 11 — Storefront & Promotions.

## Hito actual

FASE 12 — Analytics & Audit.

## Próximo hito

FASE 13 — Admin Web.

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
- Catálogo storefront público con selects explícitos: publica disponibilidad
  agregada, pero nunca costos, bodega ni saldos físico/reservado.
- Promociones automáticas o por cupón, globales o por variantes, con vigencia,
  mínimo, tope, prioridad, alcance por canal y redención histórica auditable.
- Carritos con expiración, versión y token aleatorio entregado una sola vez; en
  PostgreSQL solo queda su hash SHA-256 y un token incorrecto no revela el ID.
- Checkout guest reutiliza `OrdersService`: selecciona una bodega capaz de
  completar todo, reserva inventario y persiste orden, redención, cierre y evento
  outbox en la misma transacción; el replay igual no duplica y uno distinto da 409.
- 110 unit tests en 28 suites y 6 e2e correctos; smoke HTTP real aprobó catálogo
  sanitizado, descuento exacto de 1.499 CLP, una reserva y replay idempotente.
- `AuditModule` registra cada mutación autenticada como `ATTEMPTED` antes de
  ejecutar el handler y la finaliza una vez como `SUCCEEDED` o `FAILED`, sin
  persistir body, query, mensajes de error, PII ni secretos.
- `GET /api/v1/audit-logs` exige `audit.read`, deriva el tenant de la sesión y
  ofrece paginación y filtros por actor, outcome, método, recurso, correlation ID,
  rango temporal y búsqueda.
- 120 unit tests en 30 suites y 6 e2e correctos; smoke HTTP/PostgreSQL de Audit
  aprobó éxito/fallo, 401, permiso provisionado, ausencia del secreto enviado y
  rechazo de UPDATE/DELETE por el trigger append-only.

## Funcionalidades pendientes

- KPIs reales, reportes paginados e indexación medida de sus consultas.
- Workers de outbox, frontend y hardening de producción.

## Estado parcial de Fase 12

- Implementado: modelo/migración, trigger protector, `AuditModule`, interceptor
  global para mutaciones autenticadas, permiso `audit.read`, endpoint tenant-safe,
  filtros/paginación, pruebas unitarias y smoke real.
- Pendiente: overview/KPIs, reporte diario paginado y medición de sus consultas.
- Alcance conocido: los rechazos 401/403 ocurren antes del interceptor y no generan
  `AuditLog`; si una finalización falla, la mutación exitosa conserva su respuesta
  y el registro durable queda `ATTEMPTED` para diagnóstico/reconciliación.

## Problemas conocidos

- `npm audit --omit=dev` informa tres vulnerabilidades altas transitivas por
  `deepmerge-ts` dentro de la CLI Prisma. La corrección automática propone
  degradar Prisma 7 a Prisma 6 y no debe aplicarse sin una migración evaluada.
- La auditoría no captura rechazos de guards 401/403 y aún no existe un proceso
  automático para reconciliar intentos cuya finalización falle.
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
- Un `SalesChannel` `OWN_STOREFRONT` configura TTL/envío y delimita el contrato
  público mediante slug de organización y key de canal.
- El token de carrito es bearer opaco hasheado; el checkout liga una única orden
  al carrito y su huella incluye payload normalizado más versión.
- Promociones se calculan en enteros CLP y solo se conserva la mejor automática;
  cupones se eligen explícitamente y una redención congela sus datos comerciales.
- Las mutaciones autenticadas escriben primero un intento de auditoría; si esa
  escritura falla, el handler no se ejecuta. La finalización nunca almacena el
  body/query/error y un fallo posterior no reemplaza la respuesta de negocio.

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
| `20260823004000_add_storefront_promotions` | Aplicada | Promociones, carritos, redenciones y origen storefront de pedidos |
| `20260823005000_add_analytics_audit` | Aplicada | Base persistente e inmutable de auditoría administrativa |

La base local contiene datos ficticios de desarrollo creados durante los smoke
tests: una organización, dos usuarios, seis roles, treinta y cuatro permisos, una
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
El smoke de Storefront agregó un canal propio, un cupón, un carrito finalizado,
una redención, un pedido `PENDING`, una reserva y el evento de checkout; el replay
no creó una segunda orden ni incrementó otra vez el reservado.
El seed de este checkpoint elevó el catálogo RBAC a treinta y cuatro permisos y
el smoke de Audit agregó dos registros terminales: uno exitoso y uno fallido; el
valor sensible usado para probar validación no se persistió.

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

Retomar exactamente en Fase 12 después del checkpoint de auditoría: diseñar e
implementar `ReportsModule` con un overview de KPIs reales y un reporte diario
paginado, siempre tenant-safe mediante `reports.read`, rangos temporales acotados,
importes CLP exactos y pruebas de aislamiento/consultas. Medir las consultas e
incorporar índices solo si la evidencia lo exige. No iniciar Fase 13 todavía.
