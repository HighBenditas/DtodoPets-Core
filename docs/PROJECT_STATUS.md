# Estado del proyecto

Actualizado: 2026-11-16.

## Validación actual — Etapa 2A

- Backend POS corregido para salidas inmediatas `SALE` sin tocar reservas;
  `COMMIT` conserva el consumo de reservas de pedidos existentes.
- Dos migraciones aditivas aplicadas únicamente a `dtodopets_stage1_test`.
  La base comercial `dtodopets` no fue migrada ni modificada.
- Doce regresiones HTTP/PostgreSQL reales aprobadas: 10→9, venta múltiple,
  pagos mixtos, disponibilidad reservada, idempotencia secuencial/concurrente,
  última unidad, rollback tardío, tenant, restricciones SQL y contratos de
  pedidos/transferencias/devoluciones tradicionales.
- Prisma format/validate/generate, lint, typecheck y build aprobados; 128 pruebas
  unitarias backend, 6 HTTP con mocks y 9 pruebas frontend aprobadas.
- La prueba de reinicio conservó productos, saldos, movimientos, pedidos y pagos
  de la base sintética. Las huellas de la base comercial siguen iguales.
- La bodega operativa única requiere una relación explícita por organización;
  propuesta y alternativas en `docs/POS_STAGE2A.md`. No se fusionaron bodegas.
- Devolución POS con reintegro sigue pendiente: ReturnsService exige actualmente
  una reserva de origen. No se modificó ese módulo en esta entrega.
- No se inició Etapa 2B ni hubo llamadas a Mercado Libre o merge. La publicación
  de Etapa 2A en la rama de desarrollo fue autorizada explícitamente por el usuario.

Las secciones siguientes conservan el registro histórico de los hitos de agosto.
Las cantidades y smoke tests históricos no sustituyen esta validación actual.

## Estado actual

DTodoPets Core tiene un backend NestJS 11 con Prisma 7, foundation HTTP,
Identity & Access, sucursales/bodegas, catálogo, inventario, clientes, pedidos,
pagos, devoluciones, logística, canales e integraciones multi-tenant. PostgreSQL
y Redis funcionan en Docker. Mercado Libre ya mapea/importa y el storefront
público ofrece catálogo, promociones, carrito y checkout idempotente sin
tienda visual. Analytics & Audit ofrece auditoría administrativa, overview de
KPIs y ventas diarias paginadas. Admin Web ya tiene scaffold React/Vite, login,
sesión rotativa y shell responsive. Caja POS e importación RealBase son las
primeras vistas operativas conectadas; las demás vistas de dominio siguen
pendientes.

## Último hito completado

FASE 12 — Analytics & Audit.

## Hito actual

FASE 13 — Admin Web.

## Próximo hito

FASE 14 — Automations & AI.

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
- `ReportsModule` expone `GET /api/v1/reports/overview` con ventas realizadas,
  estados de órdenes/carritos, clientes, inventario, promociones y flujo exacto
  de pagos/reembolsos para un rango UTC tenant-safe.
- `GET /api/v1/reports/daily-sales` agrupa pedidos `CONFIRMED`/`COMPLETED` por día
  UTC, pagina solo días con ventas y devuelve subtotal, descuento, envío, total y
  ticket promedio como strings CLP, con `from` inclusivo y `to` exclusivo.
- 123 unit tests en 31 suites y 6 e2e correctos; smoke HTTP real confirmó 401,
  rango máximo, permiso, paginación y consistencia de 2 ventas/75.650 CLP. El
  `EXPLAIN (ANALYZE, BUFFERS)` local tardó 0,115 ms sobre 6 pedidos y no justificó
  otro índice ni migración.
- Admin Web React 19/Vite 8 con TypeScript estricto, configuración de entorno,
  login, logout, restauración y rotación de sesión, reintento único tras 401,
  rutas protegidas y cliente HTTP con errores/correlation ID seguros.
- Shell responsive con navegación filtrada por permisos, estados de carga/error,
  menú móvil, perfil y placeholders explícitamente deshabilitados para las vistas
  aún no implementadas; no usa datos de dominio simulados.
- 6 tests de frontend en 2 suites y build de producción correctos. Smoke real
  aprobó assets `200`, CORS `204`, login con 34 permisos, rotación, replay `401`
  y logout `204` contra la API/PostgreSQL locales.
- Importador RealBase de Excel `.xlsx` con vista previa, códigos conservados como
  texto, diagnóstico de errores/advertencias y aplicación transaccional que
  actualiza catálogo, referencias externas, saldo absoluto y ledger.
- El archivo real `44597_stock_actual_c5489ead.xlsx` fue validado sin aplicarlo:
  1.240 filas, 1.188 válidas, 52 bloqueos, 50 stocks negativos, 51 inactivas y
  61 advertencias. La UI exige confirmar la omisión de filas bloqueadas.
- Caja POS para consumidor final con búsqueda/lector de código, carrito, stock
  disponible por bodega, pago simple o mixto (efectivo, transferencia, débito y
  crédito), operadores de terminal, vuelto e idempotencia de la venta completa.
- La venta POS crea orden confirmada, items, pagos, historial, movimientos
  `SALE` y evento `pos.sale-completed` dentro de la misma transacción; no puede
  vender stock reservado ni dejar saldos negativos.
- Una variante local admite varias publicaciones Mercado Libre, conservando la
  unicidad del item/variación externo. El piloto usará DTodoPets como stock
  maestro y un margen inicial de seguridad de una unidad para marketplaces.
- Nuevos permisos `imports.manage` y `pos.sell`, provisionados en el seed; el
  Owner local inicia sesión con 36 permisos.
- 127 unit tests backend en 33 suites, 6 e2e y 9 tests frontend en 3 suites;
  Prisma validate/generate, lint, typecheck y builds productivos correctos. El
  smoke HTTP real aprobó login, permisos, bodegas, catálogo POS y preview del
  Excel real sin mutar productos ni stock.

## Funcionalidades pendientes

- Vistas Admin Web de reportes, pedidos, catálogo general, inventario, clientes,
  pagos, logística, canales, usuarios y configuración.
- Emisión de boleta/factura mediante RealBase API v2 e impresión térmica 80 mm.
- Sincronización automática de stock/pedidos con Mercado Libre y futuros
  marketplaces Lider/Falabella.
- Workers de outbox, automatizaciones y hardening de producción.

## Cierre de Fase 12

- Implementado: modelo/trigger de auditoría, captura y consulta tenant-safe,
  `ReportsModule`, overview multidominio, reporte diario, rangos acotados, CLP
  exacto, pruebas, smoke real y medición de consultas.
- No se agregó migración de reportes: son proyecciones de lectura y el planner no
  mostró evidencia suficiente para otro índice en el dataset local.
- Alcance conocido: los rechazos 401/403 ocurren antes del interceptor y no generan
  `AuditLog`; si una finalización falla, la mutación exitosa conserva su respuesta
  y el registro durable queda `ATTEMPTED` para diagnóstico/reconciliación.

## Checkpoint parcial de Fase 13

- Implementado: scaffold frontend, cliente API, autenticación, recuperación de
  401, restauración/rotación, logout, rutas protegidas y shell responsive basado
  en permisos reales.
- Validado: lint, typecheck, 6 tests, build y smoke HTTP cruzado con la API real.
  El primer login falló porque Docker Desktop estaba detenido; con PostgreSQL y
  Redis saludables no se reprodujo ningún defecto de backend.
- Configuración local: `backend/.env` requiere `CORS_ORIGINS=http://localhost:5173`
  para Vite; el ejemplo versionado ya lo contempla.
- Se implementaron los primeros slices de dominio: Caja e Importar datos, ambos
  conectados a contratos reales y filtrados por permisos.
- La migración local `add_pos_sales` está aplicada y el seed fue actualizado. La
  importación del Excel comercial no se aplicó para evitar cambiar inventario sin
  una decisión explícita sobre las 52 filas bloqueadas.
- No se inició la Fase 14.

## Problemas conocidos

- `npm audit --omit=dev` informa cinco vulnerabilidades: tres altas transitivas
  por `deepmerge-ts` dentro de Prisma y dos moderadas por `uuid` dentro de
  ExcelJS. Las correcciones automáticas proponen downgrades incompatibles de
  Prisma/ExcelJS y no deben aplicarse sin una migración evaluada.
- La auditoría no captura rechazos de guards 401/403 y aún no existe un proceso
  automático para reconciliar intentos cuya finalización falle.
- El refresh token del Admin Web vive temporalmente en `sessionStorage` y queda
  expuesto ante XSS. Antes de producción debe migrarse a cookie `HttpOnly`,
  `Secure` y `SameSite` mediante un endpoint web/BFF con protección CSRF.
- La verificación visual responsive sigue pendiente: el controlador del navegador
  local no inició por un error de ruta de Windows incluso después de reiniciarlo.
  Tests DOM, build y smoke HTTP sí pasan.
- La venta POS todavía no emite el DTE tributario en RealBase ni imprime la
  boleta; el evento durable existe para implementar ese adaptador sin acoplarlo a
  la transacción de caja.
- No hay pipeline CI y faltan las demás vistas de dominio en el Admin Web.

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
- Los reportes derivan el tenant de la sesión, usan UTC y rangos de hasta 366 días.
  Ventas realizadas son órdenes actualmente `CONFIRMED`/`COMPLETED`; pagos y
  reembolsos se informan aparte por su propia fecha para no confundir venta y caja.
- El Admin Web conserva el access token solo en memoria, rota un refresh token
  temporal en `sessionStorage` y nunca decide autorización: la navegación es una
  ayuda de UX, mientras guards y permisos del backend siguen siendo autoritativos.
- DTodoPets será la fuente maestra de stock después de un piloto reconciliado.
  Mercado Libre comienza con margen de seguridad 1; Lider es el siguiente
  marketplace prioritario y Falabella queda después.
- RealBase sigue siendo el emisor tributario. La máquina Transbank/Mercado Pago/
  BancoEstado registra la transacción, pero la venta no se considera lista para
  impresión fiscal hasta que el adaptador RealBase confirme su DTE.

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
| `20260828183000_add_pos_sales` | Aplicada | Checkout POS, cliente opcional, canal de venta y listings múltiples por variante |

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
El seed de este checkpoint elevó el catálogo RBAC a treinta y seis permisos y
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
npm run test:e2e
npm run build
cd ../frontend
npm run check
npm run build
```

## Cómo continuar el desarrollo

Lee `AGENTS.md` y `docs/ROADMAP.md`, comprueba un worktree limpio, completa el
hito actual y ejecuta toda la validación obligatoria antes de actualizar estos
documentos.

## NEXT ACTION

Revisar con el usuario los resultados de Etapa 2A antes de iniciar Etapa 2B.
Priorizar la decisión de bodega operativa por organización, lector POS/permisos
y origen para devoluciones POS. No aplicar las migraciones nuevas a `dtodopets`
sin un respaldo recuperable y autorización específica. No habilitar Mercado Libre
ni importar stock comercial durante esta revisión.
