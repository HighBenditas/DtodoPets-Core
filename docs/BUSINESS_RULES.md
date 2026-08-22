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

## Comprometidas para próximos hitos

### Multi-tenancy

- Toda operación de negocio se limita a la organización autenticada.
- Nunca se acepta un `organizationId` del body como prueba de autorización.

### Idempotencia

- Reintentos de proveedor no duplican pedidos, pagos ni efectos de inventario.
- Cada integración define una clave estable y una respuesta repetible.

### Fechas

- Persistencia en UTC; presentación en la zona horaria de Chile cuando aplique.
