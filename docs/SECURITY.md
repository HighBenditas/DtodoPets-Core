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

## Riesgos pendientes

- Rate limiting específico de auth y recuperación de contraseña se abordarán en
  hardening; no hay endpoint de recuperación expuesto actualmente.
- La CLI Prisma incluye una dependencia transitiva `deepmerge-ts` reportada por
  npm con severidad alta. `npm audit fix --force` propone un downgrade mayor y
  no se aplicará. Se vigilará una versión Prisma corregida compatible.
- Retención, exportación y eliminación/anonimización de datos personales deberá
  definirse antes de producción; hoy se usa desactivación lógica para conservar
  consistencia histórica.

## Reporte y revisión

No publiques vulnerabilidades ni secretos en issues públicos. Antes de cada
release ejecuta auditoría de dependencias, revisión de permisos, pruebas de
aislamiento por tenant y comprobación de logs/respuestas de error.
