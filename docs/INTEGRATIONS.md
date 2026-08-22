# Integraciones

No hay integraciones externas implementadas todavía.

## Diseño objetivo

- Los dominios dependen de puertos internos, no de SDKs de marketplaces.
- `SalesChannel`, `Integration` y `ExternalReference` separarán referencias
  externas del pedido/producto interno.
- Cada entrada de webhook conservará proveedor, identificador idempotente,
  estado, timestamps y error seguro.
- Credenciales se cifrarán o residirán en un gestor de secretos; nunca en Git.
- Eventos como `order.created`, `order.paid` o `inventory.low_stock` comenzarán
  dentro del monolito y podrán publicarse a infraestructura externa después.

## Mercado Libre

El adaptador futuro deberá validar autenticidad, evitar pedidos duplicados con
una constraint por canal/referencia, mapear productos y registrar cargos,
bonificaciones y envíos sin contaminar el modelo central.

## Automatización e IA

n8n, WhatsApp y agentes IA consumirán APIs o eventos explícitos. No tendrán
acceso directo a tablas internas ni recibirán secretos o datos innecesarios.
