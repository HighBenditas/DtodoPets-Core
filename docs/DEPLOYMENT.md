# Despliegue

El despliegue productivo todavía no está implementado. Este documento registra
las condiciones que deberán cumplirse antes de exponer el sistema.

## Flujo objetivo

1. Construir artefacto o imagen inmutable desde un commit probado.
2. Inyectar secretos mediante el proveedor, nunca desde archivos versionados.
3. Crear un backup verificado antes de migraciones sensibles.
4. Ejecutar `prisma migrate deploy` una sola vez por release.
5. Desplegar instancias y comprobar health/readiness.
6. Conservar rollback de aplicación compatible con el esquema migrado.

## Requisitos de producción pendientes

- HTTPS en proxy/balanceador y CORS restringido.
- PostgreSQL administrado con backups cifrados, PITR y pruebas de restauración.
- Redis con autenticación/red privada cuando sea utilizado por la aplicación.
- Logs estructurados centralizados, métricas y alertas.
- Rotación de secretos y política de acceso mínimo.
- Pipeline CI/CD con lint, typecheck, tests, build y revisión de migraciones.

Docker Compose actual es solo para desarrollo local.
