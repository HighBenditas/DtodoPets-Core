# Seguridad

## Principios

- Denegar por defecto: endpoints administrativos requieren autenticación y el
  permiso explícito correspondiente.
- El tenant se deriva de la sesión; un ID enviado por el cliente no concede
  acceso.
- Contraseñas se almacenan únicamente mediante hash lento con salt.
- Refresh tokens se almacenan hasheados y pueden revocarse/rotarse.
- No se almacenan datos de tarjeta, secretos o tokens en logs/auditoría.
- Toda entrada externa se valida en runtime.

## Controles implementados

- Guards globales JWT y permisos con sesión/tenant consultados en PostgreSQL.
- Scrypt con salt para contraseñas; refresh tokens opacos almacenados como hash.
- Rotación atómica y revocación inmediata de sesiones.
- ValidationPipe whitelist, filtro de error seguro, Helmet, CORS configurable y
  correlation IDs.
- Los `.env` están ignorados y existen ejemplos sin secretos.
- Clientes, RUT, teléfonos y direcciones solo se exponen con permisos
  `customers.*`, siempre filtrados por tenant; no deben incluirse en logs.
- Pedidos y snapshots personales requieren permisos `orders.*`, se filtran por
  tenant y tampoco deben incluirse íntegros en logs o mensajes de error.
- Pagos/reembolsos/devoluciones requieren permisos `payments.*`/`returns.*`.
  Claves idempotentes y referencias externas se conservan, pero la huella
  SHA-256 interna nunca se expone; no se almacenan datos de tarjeta.
- Logistics exige permisos `shipments.*`; tracking y snapshots de historial se
  limitan al tenant y la huella idempotente tampoco se expone.
- Credenciales de integración usan AES-256-GCM con nonce aleatorio y AAD
  tenant/key. La API solo expone `hasCredentials`; nunca ciphertext ni secretos.
- El webhook de Mercado Libre normaliza la IP remota y exige que figure en
  `config.webhookAllowedIps`; también compara vendedor y aplicación configurados.
  Sus IDs/huellas evitan replays con contenido distinto.
- Las huellas de pedidos externos se persisten para idempotencia pero se omiten
  de las respuestas; las credenciales solo se descifran dentro del adaptador.
- `@Public()` omite coherentemente JWT y RBAC heredado. Debe usarse solo cuando
  exista otro control explícito, como la allowlist del webhook.
- El storefront público usa selects allowlist que omiten costo, saldos internos,
  bodegas, credenciales y superficies administrativas. Su tenant se resuelve por
  organización/canal activos, no desde un `organizationId` del body.
- El acceso a carrito es un secreto bearer de 256 bits; solo se guarda SHA-256,
  se limita el largo del header y un fallo siempre responde 404. La huella de
  checkout tampoco se expone.
- Checkout valida DTOs anidados, normaliza PII, revalida stock/precios y usa
  unicidad/locks para no duplicar pedido, reserva ni redención bajo reintentos.
- La auditoría crea un intento antes de cada mutación autenticada y deriva
  tenant, actor y sesión del principal. Solo persiste ruta/acción/resultado e IDs
  operativos; no almacena body, query ni mensajes de excepción. `audit.read`
  protege la consulta y PostgreSQL impide borrar o reescribir entradas terminales.
- Los reportes requieren `reports.read`, reciben el tenant solo desde la sesión,
  parametrizan el SQL diario y acotan la ventana a 366 días para limitar abuso.

## Riesgos pendientes

- Rate limiting específico de auth y recuperación de contraseña se abordarán en
  hardening; no hay endpoint de recuperación expuesto actualmente.
- La CLI Prisma incluye una dependencia transitiva `deepmerge-ts` reportada por
  npm con severidad alta. `npm audit fix --force` propone un downgrade mayor y
  no se aplicará. Se vigilará una versión Prisma corregida compatible.
- Retención, exportación y eliminación/anonimización de datos personales deberá
  definirse antes de producción; hoy se usa desactivación lógica para conservar
  consistencia histórica.
- La lista de IPs de Mercado Libre debe revisarse contra su documentación. Antes
  de operar detrás de un proxy se deberá configurar un ingress confiable; el
  backend actual usa la IP directa y no confía en `X-Forwarded-For`.
- El worker de outbox deberá validar `resource` y consultar la API de Mercado
  Libre antes de aplicar el payload de una notificación al estado del negocio.
- Antes de publicar el storefront se requiere rate limiting/WAF para creación y
  mutación de carritos, política antiabuso del checkout y controles operativos de
  retención de carritos/PII guest.
- Los rechazos de autenticación/autorización ocurren antes del interceptor de
  auditoría. También falta automatizar la reconciliación de intentos que queden
  abiertos si falla su escritura terminal.

## Reporte y revisión

No publiques vulnerabilidades ni secretos en issues públicos. Antes de cada
release ejecuta auditoría de dependencias, revisión de permisos, pruebas de
aislamiento por tenant y comprobación de logs/respuestas de error.
