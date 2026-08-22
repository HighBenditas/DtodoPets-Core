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

## Estado inicial y riesgos

- El CRUD de organizaciones está actualmente abierto; se corregirá en Identity.
- Aún no hay rate limiting, headers seguros, CORS restringido ni filtro de error.
- Los `.env` están ignorados por Git; faltan ejemplos sin secretos.
- La CLI Prisma incluye una dependencia transitiva `deepmerge-ts` reportada por
  npm con severidad alta. `npm audit fix --force` propone un downgrade mayor y
  no se aplicará. Se vigilará una versión Prisma corregida compatible.

## Reporte y revisión

No publiques vulnerabilidades ni secretos en issues públicos. Antes de cada
release ejecuta auditoría de dependencias, revisión de permisos, pruebas de
aislamiento por tenant y comprobación de logs/respuestas de error.
