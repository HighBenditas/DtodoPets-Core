# Integraciones

Existe una base multi-tenant para canales/adaptadores y un primer adaptador de
Mercado Libre. No realiza llamadas salientes a la API externa todavía: recibe
snapshots/mappings e importa payloads ya resueltos mediante endpoints internos.

## Diseño objetivo

- Los dominios dependen de puertos internos, no de SDKs de marketplaces.
- `SalesChannel`, `Integration` y `ExternalReference` ya separan referencias
  externas de pedidos, productos, variantes, clientes y shipments internos.
- `WebhookReceipt` conserva integración, identificador idempotente, payload,
  huella SHA-256, estado, intentos, timestamps y error seguro.
- Credenciales se cifran con AES-256-GCM usando `INTEGRATION_ENCRYPTION_KEY`;
  ciphertext y secretos nunca salen por API ni se guardan en Git.
- `DomainEvent` implementa una outbox transaccional pendiente de workers/adaptadores
  específicos para publicación, reintento y observabilidad.

## Mercado Libre

- Provider estable: `mercado-libre`; tokens de acceso permanecen en credenciales
  cifradas y nunca se devuelven por API.
- `MercadoLibreListing` traduce item/variación externa a `ProductVariant` y
  conserva snapshots trazables de disponibilidad, precio y comisión CLP.
- La importación reutiliza `OrdersService`: precios siguen viniendo del catálogo
  local y la reserva de inventario ocurre en la transacción del pedido.
- `sourceIntegrationId + externalOrderId` es único. `sourceRequestHash` distingue
  un replay equivalente de la reutilización conflictiva del ID.
- Cada orden se enlaza también mediante `ExternalReference(ORDER)` y emite
  `mercado-libre.order.imported`. Un retry completa artefactos faltantes sin
  repetir el evento.
- El endpoint público normaliza la IP remota y exige que figure en
  `config.webhookAllowedIps`; también compara `user_id`/`application_id` con
  `config.sellerId`/`config.applicationId`. Luego crea un `WebhookReceipt` y
  `mercado-libre.webhook.received` en una transacción con respuesta HTTP 200.
- La notificación solo se considera un aviso. El worker posterior deberá
  consultar `resource` en la API oficial antes de aplicar cambios de negocio.
- La outbox queda en estado `PENDING`; publicación, backoff y consumo de topics
  específicos corresponden a un worker posterior.

Próximos incrementos del adaptador: cliente HTTP saliente, OAuth/renovación de
token, pull/push real de publicaciones y stock, workers de topics y conciliación
de cargos/envíos del marketplace.

El contrato se contrastó con la documentación oficial de
[notificaciones de Mercado Libre](https://developers.mercadolibre.cl/es_ar/publica-productos/productos-recibe-notificaciones).

## Automatización e IA

n8n, WhatsApp y agentes IA consumirán APIs o eventos explícitos. No tendrán
acceso directo a tablas internas ni recibirán secretos o datos innecesarios.
