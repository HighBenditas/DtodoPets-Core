# API

Este documento distingue endpoints implementados de endpoints planificados.

## Implementados

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| GET | `/health` | No | Comprueba conectividad con PostgreSQL |
| GET | `/api/v1` | No | Devuelve nombre y versión de la API |
| POST | `/api/v1/auth/bootstrap` | No, primera instalación | Crea organización, RBAC, Owner y sesión |
| POST | `/api/v1/auth/login` | No | Inicia sesión por organización/email/password |
| POST | `/api/v1/auth/refresh` | No | Rota un refresh token opaco |
| POST | `/api/v1/auth/logout` | Bearer | Revoca la sesión actual (204) |
| GET | `/api/v1/auth/me` | Bearer | Devuelve identidad, roles y permisos |
| POST | `/api/v1/auth/change-password` | Bearer | Cambia contraseña y revoca otras sesiones (204) |
| GET | `/api/v1/organizations` | Bearer + `organizations.read` | Devuelve solo la organización actual |
| GET | `/api/v1/organizations/:id` | Bearer + `organizations.read` | Obtiene la organización propia |
| PATCH | `/api/v1/organizations/:id` | Bearer + `organizations.read/update` | Actualiza nombre o slug propios |
| GET | `/api/v1/users` | Bearer + `users.manage` | Lista usuarios del tenant |
| GET | `/api/v1/users/:id` | Bearer + `users.manage` | Obtiene usuario del tenant |
| POST | `/api/v1/users` | Bearer + `users.manage` | Crea usuario administrativo |
| PATCH | `/api/v1/users/:id` | Bearer + `users.manage` | Edita nombre/estado |
| PUT | `/api/v1/users/:id/roles` | Bearer + `users.manage` | Reemplaza roles con protección Owner |
| GET | `/api/v1/roles` | Bearer + `users.manage` | Lista roles y permisos del tenant |
| POST | `/api/v1/roles` | Bearer + `users.manage` | Crea rol personalizado |
| PATCH | `/api/v1/roles/:id` | Bearer + `users.manage` | Edita rol no-system |
| PUT | `/api/v1/roles/:id/permissions` | Bearer + `users.manage` | Reemplaza permisos de rol no-system |
| DELETE | `/api/v1/roles/:id` | Bearer + `users.manage` | Elimina rol no asignado (204) |
| GET | `/api/v1/locations` | Bearer + `locations.read` | Lista paginada del tenant |
| GET | `/api/v1/locations/:id` | Bearer + `locations.read` | Obtiene sucursal del tenant |
| POST | `/api/v1/locations` | Bearer + `locations.manage` | Crea sucursal |
| PATCH | `/api/v1/locations/:id` | Bearer + `locations.read/manage` | Actualiza sucursal/estado |
| GET | `/api/v1/warehouses` | Bearer + `warehouses.read` | Lista paginada con sucursal |
| GET | `/api/v1/warehouses/:id` | Bearer + `warehouses.read` | Obtiene bodega del tenant |
| POST | `/api/v1/warehouses` | Bearer + `warehouses.manage` | Crea bodega |
| PATCH | `/api/v1/warehouses/:id` | Bearer + `warehouses.read/manage` | Actualiza bodega/estado |
| GET | `/api/v1/brands` | Bearer + `products.read` | Lista paginada de marcas |
| GET | `/api/v1/brands/:id` | Bearer + `products.read` | Obtiene marca del tenant |
| POST | `/api/v1/brands` | Bearer + `products.create` | Crea marca |
| PATCH | `/api/v1/brands/:id` | Bearer + `products.read/update` | Actualiza marca/estado |
| GET | `/api/v1/categories` | Bearer + `products.read` | Lista categorías con padre y conteos |
| GET | `/api/v1/categories/:id` | Bearer + `products.read` | Obtiene categoría del tenant |
| POST | `/api/v1/categories` | Bearer + `products.create` | Crea categoría |
| PATCH | `/api/v1/categories/:id` | Bearer + `products.read/update` | Actualiza categoría/jerarquía |
| GET | `/api/v1/products` | Bearer + `products.read` | Lista paginada con variantes e imágenes |
| GET | `/api/v1/products/:id` | Bearer + `products.read` | Obtiene producto completo |
| POST | `/api/v1/products` | Bearer + `products.create` | Crea producto y variantes atómicamente |
| PATCH | `/api/v1/products/:id` | Bearer + `products.read/update` | Actualiza producto |
| DELETE | `/api/v1/products/:id` | Bearer + `products.read/delete` | Desactiva producto (204) |
| POST | `/api/v1/products/:id/variants` | Bearer + `products.create` | Agrega variante |
| PATCH | `/api/v1/products/:id/variants/:variantId` | Bearer + `products.read/update` | Actualiza variante |
| PUT | `/api/v1/products/:id/images` | Bearer + `products.read/update` | Reemplaza imágenes atómicamente |
| GET | `/api/v1/inventory/balances` | Bearer + `inventory.read` | Lista saldos físico/reservado/disponible |
| GET | `/api/v1/inventory/balances/:id` | Bearer + `inventory.read` | Obtiene saldo del tenant |
| GET | `/api/v1/inventory/movements` | Bearer + `inventory.read` | Lista ledger append-only |
| GET | `/api/v1/inventory/reservations` | Bearer + `inventory.read` | Lista reservas y estado |
| POST | `/api/v1/inventory/adjustments` | Bearer + `inventory.adjust` | Ajusta stock físico y registra movimiento |
| POST | `/api/v1/inventory/transfers` | Bearer + `inventory.transfer` | Transfiere entre bodegas atómicamente |
| POST | `/api/v1/inventory/reservations` | Bearer + `inventory.reserve` | Reserva disponibilidad |
| POST | `/api/v1/inventory/reservations/:id/release` | Bearer + `inventory.reserve` | Libera una reserva idempotentemente |
| GET | `/api/v1/customers` | Bearer + `customers.read` | Lista paginada y buscable del tenant |
| GET | `/api/v1/customers/:id` | Bearer + `customers.read` | Obtiene cliente con direcciones |
| POST | `/api/v1/customers` | Bearer + `customers.create` | Crea cliente normalizado |
| PATCH | `/api/v1/customers/:id` | Bearer + `customers.update` | Actualiza identidad/estado |
| GET | `/api/v1/customers/:id/addresses` | Bearer + `customers.read` | Lista direcciones del cliente |
| POST | `/api/v1/customers/:id/addresses` | Bearer + `customers.update` | Agrega dirección |
| PATCH | `/api/v1/customers/:id/addresses/:addressId` | Bearer + `customers.update` | Actualiza/desactiva dirección |
| PUT | `/api/v1/customers/:id/addresses/:addressId/default` | Bearer + `customers.update` | Define dirección default |
| GET | `/api/v1/orders` | Bearer + `orders.read` | Lista pedidos paginados del tenant |
| GET | `/api/v1/orders/:id` | Bearer + `orders.read` | Obtiene items, reservas e historial |
| POST | `/api/v1/orders` | Bearer + `orders.create` | Crea pedido y reserva stock atómicamente |
| POST | `/api/v1/orders/:id/confirm` | Bearer + `orders.update` | Confirma y consume inventario |
| POST | `/api/v1/orders/:id/cancel` | Bearer + `orders.update` | Cancela y libera reservas |
| GET | `/api/v1/payments` | Bearer + `payments.read` | Lista pagos con reembolsos y saldo neto |
| GET | `/api/v1/payments/:id` | Bearer + `payments.read` | Obtiene un pago del tenant |
| POST | `/api/v1/payments` | Bearer + `payments.create` | Registra un cobro capturado idempotente |
| POST | `/api/v1/payments/:id/refunds` | Bearer + `payments.refund` | Registra reembolso parcial/completo |
| GET | `/api/v1/returns` | Bearer + `returns.read` | Lista devoluciones parciales |
| GET | `/api/v1/returns/:id` | Bearer + `returns.read` | Obtiene items de una devolución |
| POST | `/api/v1/returns` | Bearer + `returns.create` | Devuelve items y reintegra stock opcionalmente |
| GET | `/api/v1/shipments` | Bearer + `shipments.read` | Lista shipments, costos y tracking |
| GET | `/api/v1/shipments/:id` | Bearer + `shipments.read` | Obtiene items e historial logístico |
| POST | `/api/v1/shipments` | Bearer + `shipments.create` | Crea shipment parcial idempotente |
| POST | `/api/v1/shipments/:id/transitions` | Bearer + `shipments.update` | Cambia estado y datos logísticos |
| GET | `/api/v1/sales-channels` | Bearer + `integrations.manage` | Lista canales paginados |
| POST | `/api/v1/sales-channels` | Bearer + `integrations.manage` | Crea canal y evento outbox |
| PATCH | `/api/v1/sales-channels/:id` | Bearer + `integrations.manage` | Actualiza canal |
| GET | `/api/v1/integrations` | Bearer + `integrations.manage` | Lista integraciones sin secretos |
| GET | `/api/v1/integrations/:id` | Bearer + `integrations.manage` | Detalle, referencias y webhooks |
| POST | `/api/v1/integrations` | Bearer + `integrations.manage` | Crea integración y cifra credenciales |
| PATCH | `/api/v1/integrations/:id` | Bearer + `integrations.manage` | Actualiza configuración/credenciales |
| POST | `/api/v1/integrations/:id/external-references` | Bearer + `integrations.manage` | Mapea entidad externa idempotentemente |
| POST | `/api/v1/integrations/:id/webhook-receipts` | Bearer + `integrations.manage` | Registra webhook deduplicado |
| GET | `/api/v1/integrations/events` | Bearer + `integrations.manage` | Lee últimos eventos outbox |
| GET | `/api/v1/mercado-libre/integrations/:id/listings` | Bearer + `integrations.manage` | Lista mappings y snapshots del adaptador |
| POST | `/api/v1/mercado-libre/integrations/:id/listings` | Bearer + `integrations.manage` | Crea/actualiza mapping de variante |
| POST | `/api/v1/mercado-libre/integrations/:id/orders/import` | Bearer + `integrations.manage` | Importa pedido idempotente y reserva stock |
| POST | `/api/v1/mercado-libre/webhooks/:id` | IP en allowlist | Valida origen y deduplica una notificación pública |
| GET | `/api/v1/promotions` | Bearer + `promotions.read` | Lista promociones paginadas del tenant |
| GET | `/api/v1/promotions/:id` | Bearer + `promotions.read` | Obtiene definición, alcance y redenciones contadas |
| POST | `/api/v1/promotions` | Bearer + `promotions.manage` | Crea promoción automática o cupón |
| PATCH | `/api/v1/promotions/:id` | Bearer + `promotions.manage` | Actualiza estado, vigencia y presentación |
| GET | `/api/v1/storefront/:organizationSlug/:channelKey/catalog` | No | Catálogo público sanitizado y paginado |
| GET | `/api/v1/storefront/:organizationSlug/:channelKey/catalog/:productSlug` | No | Detalle público por slug |
| GET | `/api/v1/storefront/:organizationSlug/:channelKey/promotions` | No | Promociones automáticas públicas vigentes |
| POST | `/api/v1/storefront/:organizationSlug/:channelKey/carts` | No | Crea carrito y entrega token opaco una vez |
| GET | `/api/v1/storefront/:organizationSlug/:channelKey/carts/:cartId` | `x-cart-token` | Obtiene carrito autorizado |
| PUT | `/api/v1/storefront/:organizationSlug/:channelKey/carts/:cartId/items/:variantId` | `x-cart-token` | Define cantidad de una variante |
| DELETE | `/api/v1/storefront/:organizationSlug/:channelKey/carts/:cartId/items/:variantId` | `x-cart-token` | Quita variante del carrito |
| PUT | `/api/v1/storefront/:organizationSlug/:channelKey/carts/:cartId/promotion` | `x-cart-token` | Aplica código de cupón |
| DELETE | `/api/v1/storefront/:organizationSlug/:channelKey/carts/:cartId/promotion` | `x-cart-token` | Quita cupón explícito |
| POST | `/api/v1/storefront/:organizationSlug/:channelKey/carts/:cartId/checkout` | `x-cart-token` | Crea pedido/reserva idempotentes |

Los DTO aplican whitelist y validación runtime. Los UUID de ruta se validan como
UUID v4. Conflictos Prisma `P2002` y registros ausentes `P2025` se mapean a HTTP.

## Contrato de errores

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": ["property unexpected should not exist"],
  "path": "/api/v1/organizations",
  "correlationId": "...",
  "timestamp": "2026-08-22T00:00:00.000Z"
}
```

Todos los endpoints incluyen `x-correlation-id`.

## Auth

### Bootstrap

Body: `organizationName`, `organizationSlug?`, `email`, `password` (mínimo 12),
`firstName`, `lastName?`. Responde 201 con `accessToken`, `refreshToken`,
`expiresIn`, `tokenType` y `user`. Responde 409 después del primer usuario.

### Login

Body: `organizationSlug`, `email`, `password`. Credenciales inválidas siempre
responden 401 sin revelar si tenant o usuario existen.

### Refresh

Body: `refreshToken`. Cada uso exitoso invalida el valor anterior y entrega uno
nuevo. Tokens expirados, revocados, rotados o de usuarios/organizaciones
inactivos responden 401.

## Usuarios y roles

Los bodies de usuario nunca aceptan `organizationId`; se usa el tenant del
Bearer. Solo un Owner puede asignar o administrar otro Owner, el usuario actual
no puede desactivarse y siempre debe quedar un Owner activo. Los roles `system`
no se pueden modificar; roles personalizados sí pueden configurarse con las
permission keys existentes.

## Paginación y catálogo

Query: `page` (default 1), `limit` (default 20, máximo 100), `search` y
`active=true|false`. La respuesta usa `{ data, meta: { page, limit, total,
pageCount } }`. Una bodega solo puede referenciar una sucursal del mismo tenant;
la regla está validada en servicio y mediante foreign key compuesta.

Marcas y categorías utilizan el mismo contrato. Productos además aceptan
`brandId`, `categoryId`, `species`, `active` y `search`; la búsqueda cubre
nombre, slug, SKU y código de barras. Los bodies nunca aceptan
`organizationId`. Importes `costAmount`, `priceAmount` y `salePriceAmount` son
pesos CLP enteros y se serializan desde Decimal como strings exactos.

## Inventario

Balances aceptan `warehouseId`, `variantId`, `productId`, `search`, `page` y
`limit`. Movimientos aceptan filtros por bodega, variante, tipo, operación y
referencia; reservas por bodega, variante y estado.

Ajustes usan `quantityDelta` distinto de cero. Transferencias y reservas usan
`quantity` positivo. Toda mutación exige `reason`; `referenceType` y
`referenceId` deben aparecer juntos. Repetir una reserva con la misma referencia
y cantidad o liberar una reserva ya liberada devuelve `idempotent: true` sin un
nuevo movimiento. Stock insuficiente responde 409.

## Clientes

La lista acepta `page`, `limit`, `active` y `search`; busca por nombre, correo,
teléfono o RUT. La API normaliza email a minúsculas, teléfono chileno a E.164 y
RUT al formato `12345678-5`, validando su dígito verificador. Duplicados dentro
del tenant responden 409.

La primera dirección activa siempre se vuelve default. Crear otra con
`isDefault=true` o usar la ruta `/default` reemplaza la anterior atómicamente.
Desactivar la default promueve la dirección activa más antigua.

El detalle de cliente incluye `orderSummary`: conteo de pedidos
confirmados/completados, conteos por estado y gasto total exacto de esos estados.

## Pedidos

La lista acepta `page`, `limit`, `status`, `customerId` y `search`; la búsqueda
cubre número de pedido y nombre de cliente. Los importes Decimal se serializan
como strings CLP exactos.

Crear exige cliente y dirección activos, bodega activa y entre 1 y 100 items con
variantes activas y distintas. El servidor toma el precio de oferta vigente o,
en su ausencia, el precio normal; el cliente solo envía `variantId`, `quantity`
y descuento opcional. También acepta descuento global, envío y notas. La
respuesta queda `PENDING` y reserva el inventario dentro de la transacción.

Confirmar o cancelar exige `{ "reason": "..." }`. Confirmar consume físico y
reservado y marca cada reserva `CONSUMED`; cancelar libera las reservas. Repetir
la misma transición terminal devuelve `idempotent: true` sin nuevos efectos.
Una transición incompatible responde 409, al igual que stock insuficiente.

## Pagos y reembolsos

La lista acepta `page`, `limit`, `orderId`, `status`, `method` y `search` por
proveedor, referencia externa o número de pedido. Cada pago devuelve
`refundedAmount` y `netAmount`; la huella interna del request nunca se expone.

Crear un pago exige pedido confirmado/completado, `amount` CLP positivo,
`method`, `provider` e `idempotencyKey`; acepta referencia externa y notas. La
suma neta de pagos no puede superar el total del pedido. Métodos disponibles:
`CASH`, `DEBIT_CARD`, `CREDIT_CARD`, `BANK_TRANSFER`, `STORE_CREDIT` y `OTHER`.

Reembolsar exige importe positivo, motivo e `idempotencyKey`; nunca puede
superar lo aún reembolsable del pago. Una clave repetida con el mismo payload
devuelve `idempotent: true`; con datos diferentes devuelve 409. Los estados son
`CAPTURED`, `PARTIALLY_REFUNDED` y `REFUNDED`.

## Devoluciones

La lista acepta `page`, `limit`, `orderId` y `search` por número de devolución,
pedido o cliente. Crear exige pedido confirmado/completado, motivo, clave
idempotente e items únicos con `orderItemId`, cantidad y `restock` opcional.

La suma de devoluciones de un item nunca supera lo comprado. `restock=true`
reintegra físico al saldo de origen y crea un movimiento `RETURN`; `false`
conserva la trazabilidad sin alterar inventario. El reembolso monetario sigue
siendo una operación explícita y separada.

## Logistics

La lista acepta `page`, `limit`, `orderId`, `status`, `type` y `search` por
número, carrier, tracking, pedido o cliente. El detalle incluye items, actor e
historial cronológico. `subsidyAmount` y `shippingMarginAmount` son nulos hasta
conocer costo real y luego se serializan como strings CLP exactos.

Crear exige pedido confirmado/completado, items únicos, tipo e
`idempotencyKey`. Acepta cobro al cliente asignado, costo real, carrier,
servicio, tracking y notas. La cantidad activa acumulada no supera cada item y
el cobro asignado activo no supera `Order.shippingAmount`; cancelar libera ambos.

Tipos: `PICKUP`, `OWN_DELIVERY`, `MARKETPLACE` y `EXTERNAL_COURIER`. Courier
externo exige carrier; retiro no acepta tracking. El body de transición lleva
`status`, `reason` y metadatos/costo opcionales. Flujo permitido:
`PENDING → READY → IN_TRANSIT → DELIVERED`, con entrega directa desde `READY` y
cancelación desde `PENDING`/`READY`. Retiro no entra en tránsito; courier y
marketplace requieren tracking al despacharse y toda entrega requiere costo real.

## Mercado Libre

Una integración activa debe usar `provider=mercado-libre`. El mapping exige
`variantId` e `externalItemId`; variación, precio de publicación, comisión,
disponibilidad y metadata son snapshots opcionales. Cada integración admite un
solo mapping por variante y por par item/variación. Los importes son enteros CLP
y se serializan como strings exactos.

Importar una orden exige ID externo, cliente/dirección/bodega locales e items
externos previamente mapeados. El servidor resuelve variantes y precios, crea
un `Order PENDING` y reserva stock atómicamente. El mismo ID y payload devuelve
`idempotent: true`; cualquier cambio semántico con ese ID responde 409 sin una
nueva reserva. La huella interna nunca aparece en la respuesta.

El webhook no usa Bearer. Recibe el contrato de notificación de Mercado Libre:
`_id`, `resource`, `topic`, `user_id`, `application_id` y los opcionales
`attempts`, `sent` y `received`. La IP remota normalizada debe figurar en
`Integration.config.webhookAllowedIps`; además `user_id`/`application_id` deben
coincidir con `config.sellerId`/`config.applicationId`. Una fuente o identidad
no permitida responde 401. No se confía en `X-Forwarded-For` actualmente.

Una recepción válida responde HTTP 200 después de escribir recibo y evento
outbox en una transacción. El replay reproduce el recibo y el mismo `_id` con
payload distinto responde 409. El payload solo representa un aviso: un worker
posterior deberá consultar `resource` con el access token y usar la respuesta
oficial como estado autoritativo.

## Promotions y Storefront

Las promociones administrativas aceptan `PERCENTAGE` o `FIXED_AMOUNT`, alcance
`ALL_CATALOG` o `VARIANTS`, vigencia, mínimo de compra, tope de descuento,
prioridad y canal propio opcional. `automatic=true` prohíbe código; un cupón lo
exige. Los importes son enteros CLP y el porcentaje no supera 100. La definición
comercial central no se reescribe después de crearla: `PATCH` limita cambios a
presentación, estado, prioridad y fechas.

Un storefront existe cuando hay un `SalesChannel` activo de tipo
`OWN_STOREFRONT`; se resuelve por slug de organización y key de canal. Su
`metadata` puede definir `cartTtlHours` entre 1 y 168 (default 24) y
`defaultShippingAmount` CLP (default 0). El catálogo solo publica productos,
imágenes, precio comercial y disponibilidad agregada. Nunca devuelve costo,
bodega, físico, reservado, credenciales ni campos administrativos.
Las promociones automáticas públicas incluyen `variantIds` cuando su alcance es
segmentado, usando los mismos IDs públicos del catálogo.

Crear carrito devuelve `{ cartId, cartToken, cart }`; `cartToken` es aleatorio y
solo aparece en esa respuesta. Las operaciones siguientes lo envían en
`x-cart-token`. Token ausente/incorrecto responde 404 y un carrito activo vencido
responde 410. Agregar items valida catálogo activo y disponibilidad pública;
checkout vuelve a comprobar que una sola bodega pueda completar el carrito.

El cupón explícito reemplaza promociones automáticas. Sin cupón se escoge la
promoción automática que produce el mayor descuento y prioridad resuelve
empates. Checkout recibe `customer`, `shippingAddress` y `notes?`, normaliza la
identidad, crea/reutiliza cliente/dirección y genera un `Order PENDING`. Orden,
reserva, redención, cierre `CHECKED_OUT` y evento
`storefront.checkout.completed` se escriben en una transacción.

La huella de checkout incluye carrito, versión y payload normalizado. Repetirla
devuelve `idempotent: true` y la misma orden sin otra reserva; modificar datos da
409. El carrito finalizado muestra importes/items desde los snapshots de la
orden y la promoción desde su redención, no desde precios vigentes posteriores.

## Planificados

`/api/v1/reports` se documentará aquí solo cuando exista.
