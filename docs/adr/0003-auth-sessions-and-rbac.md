# ADR 0003: Sesiones revocables y RBAC persistido

- Estado: aceptado
- Fecha: 2026-08-22

## Contexto

DTodoPets requiere logout/refresh reales, usuarios inactivos, permisos
configurables y efecto rápido de cambios administrativos. Un JWT autocontenido
con roles hardcodeados mantendría privilegios obsoletos hasta expirar.

## Decisión

Usar access JWT corto con IDs mínimos y una `AuthSession` consultada en cada
request. El refresh token es opaco, aleatorio, hasheado, rotativo y revocable.
Roles/permisos viven en PostgreSQL; seis roles de sistema se provisionan como
defaults y pueden coexistir con roles personalizados por organización.

## Consecuencias

Logout, desactivación y cambios RBAC se aplican inmediatamente y no se almacenan
refresh tokens recuperables. Cada request autenticada añade una consulta a la
base; se prioriza seguridad y consistencia, con posibilidad futura de cache
invalidable si las métricas lo justifican.
