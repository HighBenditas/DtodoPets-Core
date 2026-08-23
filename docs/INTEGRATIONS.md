# Integraciones

Existe la base multi-tenant para canales y adaptadores; todavía no hay un
proveedor externo concreto conectado.

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

El adaptador futuro deberá validar autenticidad, evitar pedidos duplicados con
una constraint por canal/referencia, mapear productos y registrar cargos,
bonificaciones y envíos sin contaminar el modelo central.

## Automatización e IA

n8n, WhatsApp y agentes IA consumirán APIs o eventos explícitos. No tendrán
acceso directo a tablas internas ni recibirán secretos o datos innecesarios.
