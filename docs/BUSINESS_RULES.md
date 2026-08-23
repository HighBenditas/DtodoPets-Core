# Reglas de negocio

Este documento separa reglas implementadas de reglas comprometidas por el
roadmap.

## Implementadas

### Organizaciones

- `name` no puede estar vacío.
- `slug` se normaliza a minúsculas ASCII y guiones.
- `slug` es único globalmente.
- `active` vale `true` por defecto.
- Un usuario autenticado solo puede leer/editar su propia organización.

### Identity & Access

- Bootstrap solo funciona mientras no exista ningún usuario y se serializa con
  un advisory lock de PostgreSQL.
- Login requiere slug de organización y correo normalizado.
- Logout o desactivación invalida acceso en la siguiente request.
- Refresh rota el token; el valor anterior no puede reutilizarse.
- Solo Owner puede asignar/administrar Owner y siempre queda uno activo.
- Los roles de sistema son inmutables; la autorización usa permisos persistidos,
  por lo que se permiten roles personalizados.

### Sucursales y bodegas

- Nombres son únicos dentro de la organización.
- Una bodega puede no pertenecer a una sucursal.
- Si tiene sucursal, ambas deben pertenecer al mismo tenant; la base también lo
  garantiza con una foreign key compuesta.
- Desactivar conserva historial y relaciones; no se expone borrado físico.

### Catálogo

- Slugs se normalizan y son únicos dentro de la organización.
- Una categoría padre, marca o categoría asociada debe estar activa y pertenecer
  al mismo tenant; las jerarquías de categoría no pueden contener ciclos.
- Cada producto se crea con al menos una variante y toda la operación es atómica.
- SKU se normaliza a mayúsculas y es único por organización; código de barras
  también es único por organización cuando existe.
- Costos y precios son enteros CLP no negativos. El precio de oferta, si existe,
  no puede superar el precio normal.
- Peso debe ser positivo, URLs de imágenes no se repiten dentro del producto y
  reemplazar imágenes es atómico.
- El endpoint DELETE de producto desactiva; no elimina físicamente.

### Inventario

- `available = physical - reserved`; las tres cantidades nunca son negativas y
  reservado nunca supera físico.
- Todo cambio crea un movimiento con actor, motivo, deltas y snapshots antes y
  después. Los movimientos no se actualizan ni eliminan.
- Ajustes solo modifican físico; reservas/liberaciones solo modifican reservado.
- Transferir crea salida y entrada con el mismo `operationId` en una transacción.
- Solo se reduce o transfiere stock disponible; falta de stock responde conflicto
  sin efectos parciales.
- Bodega, variante, saldo, actor y reserva pertenecen al tenant autenticado; FKs
  compuestas refuerzan la regla.
- Reservas con referencia estable son idempotentes. Liberar una reserva ya
  liberada también es idempotente.
- Locks de fila serializan operaciones concurrentes; las transferencias bloquean
  saldos en orden estable.

### Clientes

- Nombre es obligatorio; email, teléfono y RUT son opcionales.
- Email se normaliza a minúsculas, teléfono chileno a E.164 y RUT sin puntos con
  dígito verificador validado.
- Email, teléfono y RUT, cuando existen, son únicos dentro de la organización.
- Un cliente admite múltiples direcciones con etiqueta única.
- La primera dirección activa es default y solo puede existir una default activa.
- Cambiar/desactivar la default ocurre bajo lock; al desactivarla se promueve la
  dirección activa más antigua.
- Desactivar clientes/direcciones conserva sus datos para historial futuro.

### Pedidos y dinero

- Todo pedido pertenece al tenant autenticado y recibe un número único dentro de
  la organización.
- Cliente, dirección, bodega y variantes deben estar activos y pertenecer al
  mismo tenant; las FKs compuestas refuerzan el aislamiento.
- Un item conserva snapshots de SKU, nombre y precio. Cliente y dirección
  también se copian para que cambios posteriores no reescriban el historial.
- Todos los importes son enteros CLP exactos. El servidor obtiene precios del
  catálogo y calcula subtotales, descuentos, envío y total.
- Crear un pedido `PENDING` reserva toda su disponibilidad o no crea nada.
- Confirmar consume físico y reservado; cancelar solo libera lo reservado. Cada
  transición escribe movimientos e historial en la misma transacción.
- Solo `PENDING` puede confirmarse o cancelarse. Repetir confirmación o
  cancelación ya aplicada es idempotente; otra transición terminal responde 409.
- El gasto del cliente suma únicamente pedidos `CONFIRMED` o `COMPLETED`.

### Pagos y reembolsos

- Solo pedidos `CONFIRMED`/`COMPLETED` aceptan cobros capturados.
- Un pedido admite múltiples pagos, pero su suma menos reembolsos no supera el
  total del pedido; el cálculo ocurre bajo lock del pedido.
- Cada pago conserva método, proveedor, referencia externa opcional, importe CLP
  exacto, actor y fechas. La referencia del proveedor es única por tenant.
- Reembolsos son append-only y nunca superan el importe original del pago.
- El estado del pago se deriva del total reembolsado: capturado, parcial o total.
- Pago y reembolso exigen clave idempotente; el mismo payload se reproduce y un
  payload distinto con la misma clave responde conflicto.

### Devoluciones

- Solo pedidos `CONFIRMED`/`COMPLETED` admiten devoluciones.
- Un item puede devolverse parcialmente en varias operaciones, pero la suma no
  supera la cantidad comprada; el pedido se bloquea para evitar carreras.
- Cada línea decide si vuelve a stock. Si vuelve, utiliza el saldo de origen y
  crea un movimiento `RETURN`; si no, inventario permanece intacto.
- Devolver mercadería no reembolsa dinero implícitamente: ambos actos son
  trazables y deliberadamente separados.
- Una devolución completa es idempotente por clave y huella de su payload.

### Logistics

- Solo pedidos `CONFIRMED`/`COMPLETED` admiten shipments y un pedido puede
  dividirse en varios.
- La cantidad activa asignada de cada item no supera lo comprado. Cancelar un
  shipment libera sus cantidades para un reemplazo.
- El cobro al cliente se asigna entre shipments activos sin superar
  `Order.shippingAmount`; costo real se registra aparte.
- `subsidy=max(costo real-cobro asignado, 0)` y
  `margen=max(cobro asignado-costo real, 0)`, siempre en CLP exacto.
- Retiro no usa tracking ni estado en tránsito. Courier externo exige carrier;
  courier/marketplace en tránsito exigen tracking.
- Un shipment entregado siempre tiene costo real, incluso cero. Estados y
  metadatos quedan registrados en historial con actor y timestamps.
- Solo `PENDING`/`READY` se cancelan; entregado/cancelado es terminal. Repetir el
  estado actual es idempotente.
- Crear shipment es idempotente por clave/huella y se serializa bajo lock del
  pedido junto con asignación de items y cobro.

### Canales e integraciones

- Claves de canal/integración son estables, normalizadas y únicas por tenant.
- Configuración no secreta se separa de credenciales cifradas AES-256-GCM; las
  respuestas solo indican si existen credenciales.
- Una referencia externa mapea una entidad local y un ID externo una sola vez
  por integración/tipo; repetir el mismo mapping es idempotente.
- Un evento webhook se identifica por integración/ID externo y huella del
  payload. Mismo payload se reproduce; uno distinto responde 409.
- Cada mutación relevante escribe un `DomainEvent` pendiente en la misma
  transacción para que adaptadores posteriores procesen una outbox durable.

### Mercado Libre

- Solo una integración activa con provider `mercado-libre` puede operar el
  adaptador y siempre queda limitada al tenant autenticado.
- Una variante se mapea una vez por integración; el par item/variación externo
  tampoco puede apuntar a dos variantes. Precio, comisión y stock son snapshots,
  no sustituyen al catálogo/inventario central.
- Importar una orden resuelve todos los items antes de crearla. Si alguno no
  está mapeado, no se reserva inventario ni se persiste un pedido parcial.
- Integración e ID externo identifican una orden. La misma huella reproduce la
  respuesta sin reservar otra vez; una huella distinta responde 409.
- La referencia externa y el evento de importación se crean juntos. Un retry
  repara esos artefactos si faltaran y una constraint decide carreras.
- El webhook exige una IP normalizada presente en `config.webhookAllowedIps` y
  que `user_id`/`application_id` coincidan con el vendedor/aplicación configurados
  antes de leer/escribir recibos. Un evento repetido es idempotente y reutilizar
  su ID con otro payload responde 409.
- La ruta webhook es pública solo respecto del Bearer/RBAC; el origen se limita
  por allowlist. Las demás rutas exigen `integrations.manage`.

### Promotions y Storefront

- Solo un canal activo `OWN_STOREFRONT` de una organización activa publica una
  tienda; slug/key inválidos o de otro tenant responden 404.
- El catálogo público usa un contrato explícito. Disponibilidad es la suma
  `physical-reserved` de bodegas activas, pero nunca se publican costo, físico,
  reservado, bodega, credenciales ni metadatos administrativos.
- Una promoción es automática sin código o cupón con código; no admite ambos.
  Puede cubrir todo el catálogo o una lista no vacía de variantes activas del
  tenant y, opcionalmente, un único canal storefront del mismo tenant.
- Porcentaje está entre 1 y 100; monto fijo, mínimos, topes y resultados usan
  enteros CLP dentro de `Decimal(14,0)`. Vigencia usa inicio inclusivo y fin
  exclusivo. Sin cupón se aplica solo la automática de mayor descuento; prioridad
  decide empates.
- Crear carrito entrega un secreto aleatorio una vez y persiste únicamente su
  SHA-256. Faltar o errar el token responde 404 para no confirmar existencia.
- Mutaciones del carrito bloquean su fila, exigen estado activo/no vencido e
  incrementan versión cuando cambian items o cupón.
- Agregar un item exige variante/producto activos y disponibilidad agregada;
  checkout exige además una sola bodega capaz de completar todas las líneas.
- Checkout normaliza cliente, teléfono y dirección, toma precios actuales del
  catálogo y crea una orden `PENDING` mediante la misma regla central de Orders.
- La huella incluye ID/versión del carrito y payload normalizado. El mismo replay
  devuelve la orden existente; otro payload o versión responde 409.
- Pedido, reserva, historial, redención, estado `CHECKED_OUT` y evento outbox se
  escriben atómicamente. Una redención conserva snapshots y el carrito finalizado
  muestra los importes históricos de la orden.

### Analytics y auditoría

- Toda mutación autenticada intenta persistir auditoría antes del handler; una
  lectura exige `audit.read` y nunca incluye body, query, secretos o errores.
- Los reportes exigen `reports.read`, derivan tenant de sesión y limitan rangos a
  366 días con inicio inclusivo, fin exclusivo y agrupación UTC.
- Venta realizada significa orden cuyo estado actual es `CONFIRMED` o `COMPLETED`;
  pendientes/canceladas permanecen visibles en conteos pero no suman venta.
- Pagos capturados y reembolsos se agrupan por la fecha de cada movimiento y se
  muestran separados de ventas. `net=captured-refunded` puede ser negativo.
- Todo importe de reporte es string CLP exacto; el ticket promedio se redondea al
  peso más cercano. El diario pagina solo fechas con al menos una venta realizada.

## Comprometidas para próximos hitos

### Multi-tenancy

- Toda operación de negocio se limita a la organización autenticada.
- Nunca se acepta un `organizationId` del body como prueba de autorización.

### Idempotencia

- Reintentos de proveedor no duplican pedidos, pagos ni efectos de inventario.
- Cada integración define una clave estable y una respuesta repetible.

### Fechas

- Persistencia en UTC; presentación en la zona horaria de Chile cuando aplique.
