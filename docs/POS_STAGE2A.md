# Etapa 2A — POS e inventario central

Fecha: 2026-11-16. Alcance: backend POS, SQL y regresiones reales aisladas.

## Error y decisión

`PosService` escribía `COMMIT` con delta físico negativo y delta reservado cero.
PostgreSQL exige que `COMMIT` reduzca ambas cantidades por igual porque consume
una reserva previa. La venta inmediata fallaba con SQLSTATE 23514 y HTTP 500.

Se evaluaron tres alternativas:

| Alternativa | Evaluación |
| --- | --- |
| Admitir COMMIT sin reserva | Mezcla dos significados y debilita el contrato histórico; descartada |
| Crear y consumir una reserva artificial en cada venta | Compatible, pero agrega estados y movimientos innecesarios a una entrega inmediata |
| Movimiento SALE para salida inmediata | Elegida: conserva reservas ajenas y la semántica original de COMMIT |

`SALE` exige `physicalDelta < 0` y `reservedDelta = 0`. Conserva las validaciones
de saldo, aritmética, tenant y trigger append-only. Pedido, items, stock,
movimiento, pagos, historial y outbox permanecen en la misma transacción.
Una relectura tras bloquear saldos reproduce reintentos concurrentes antes de
rechazar una disponibilidad que la misma venta acaba de agotar.

Las dos migraciones nuevas separan la incorporación del enum de su uso en el
CHECK. Ninguna migración histórica se editó. Solo se migró la base sintética
`dtodopets_stage1_test`; `dtodopets` conserva sus 18 migraciones y datos.

## Validación y compatibilidad

Doce escenarios HTTP con autenticación y Prisma reales cubren venta 10→9,
venta múltiple, pago mixto, sobreventa, reservas de otros pedidos, replays
secuenciales/concurrentes, última unidad, fallo tardío al insertar el segundo
pago, aislamiento entre organizaciones y protecciones SQL.

El fallo tardío se fuerza con dos referencias de pago iguales: después de crear
pedido, movimiento y primer pago, el segundo viola unicidad. Se verifica que
pedido/items/pagos/movimientos/historial/outbox vuelven a sus conteos previos,
el stock no cambia y la clave idempotente puede reutilizarse. El intento fallido
de auditoría sí queda registrado, deliberadamente fuera de la transacción de
negocio.

También se confirman pedidos del contrato anterior: reservar dos de diez deja
físico 10/reservado 2; confirmar deja 8/0 y `COMMIT=-2/-2`. Repetir no vuelve a
consumir. Transferencias y devoluciones de esos pedidos conservan su contrato.
Una comparación antes/después del reinicio del PostgreSQL aislado confirma la
persistencia de variantes, saldos, movimientos, pedidos y pagos.

Resultados y logs detallados: carpeta externa `../stage2a-validation-20261116/`
desde la raíz Git. Allí se conserva también `baseline-source.tar`, copia del
commit original previa a los cambios. No contiene los `.env` ignorados.

## Bodega operativa — propuesta pendiente

La base existente contiene una sucursal y tres bodegas. Esta entrega no elimina,
fusiona, renombra ni reasigna ninguna. El POS actual valida bodega activa y
tenant, pero todavía acepta cualquier bodega activa de esa organización.

Se propone `Organization.operationalWarehouseId`, opcional durante la migración,
con FK compuesta `(operationalWarehouseId, id) → Warehouse(id, organizationId)`.
La selección inicial debe ser explícita y revisada con el operador, sin inferir
la primera bodega ni consolidar saldos.

En una próxima entrega:

1. Resolver la bodega desde el tenant autenticado y validar que esté activa.
2. Rechazar la operación si no está configurada o si un warehouseId enviado por
   el cliente es distinto; no elegir una alternativa automáticamente.
3. Exponer la configuración de caja con permiso `pos.sell`, sin depender del
   permiso administrativo de listar bodegas; la UI mostrará la bodega fijada.
4. Mantener múltiples bodegas para futuras ampliaciones y otros permisos.

Es un cambio de esquema/contrato/configuración/UI distinto del bloqueo SQL del
POS, por lo que se documenta para revisión y no se implementa en Etapa 2A.

## Límites y siguiente revisión

- La devolución POS con reintegro responde actualmente 409: ReturnsService exige
  `inventoryReservation` como origen y las ventas inmediatas no la tienen.
  Se detectó con PostgreSQL real. Resolver origen desde el movimiento SALE o
  persistir un origen explícito requiere una entrega posterior; no se modificó
  ReturnsService ni se presentó esa operación como aprobada.
- Lector POS, permisos de Seller, sesión web y bodega operativa requieren trabajo
  posterior. No se validó la interfaz ni se habilita operación comercial.
- No se corrigieron dependencias vulnerables, emisión DTE ni impresión.
- Las migraciones comerciales quedan pendientes de respaldo recuperable,
  autorización y procedimiento de despliegue. No ejecutar el nuevo backend para
  ventas comerciales contra un esquema que todavía no admite SALE.
- No hubo llamadas a Mercado Libre, merge ni inicio de Etapa 2B. La publicación
  de estos cambios en la rama de desarrollo fue autorizada por el usuario.

NEXT ACTION: revisar resultados con el usuario y acordar la siguiente entrega.
