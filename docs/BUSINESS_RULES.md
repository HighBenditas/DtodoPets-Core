# Reglas de negocio

Este documento separa reglas implementadas de reglas comprometidas por el
roadmap.

## Implementadas

### Organizaciones

- `name` no puede estar vacío.
- `slug` se normaliza a minúsculas ASCII y guiones.
- `slug` es único globalmente.
- `active` vale `true` por defecto.

## Comprometidas para próximos hitos

### Multi-tenancy

- Toda operación de negocio se limita a la organización autenticada.
- Nunca se acepta un `organizationId` del body como prueba de autorización.

### Inventario

- `physical = available + reserved` cuando no existan estados adicionales.
- Ningún cambio ocurre sin movimiento, actor/motivo y referencia aplicable.
- Confirmar, cancelar y devolver pedidos actualiza reservas/stock atómicamente.
- No se permite disponibilidad negativa accidental.

### Pedidos y dinero

- Un item conserva SKU, nombre, precio y descuento históricos.
- Totales se calculan con tipos monetarios exactos para CLP.
- El pedido se separa de pagos y shipments.

### Idempotencia

- Reintentos de proveedor no duplican pedidos, pagos ni efectos de inventario.
- Cada integración define una clave estable y una respuesta repetible.

### Fechas

- Persistencia en UTC; presentación en la zona horaria de Chile cuando aplique.
