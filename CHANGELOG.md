# Changelog

Los cambios relevantes de DTodoPets Core se registran aquí siguiendo una
estructura inspirada en Keep a Changelog.

## [Unreleased]

### Added

- Documentación inicial de arquitectura, base de datos, desarrollo, seguridad,
  integraciones, pruebas, despliegue, reglas de negocio, estado y roadmap.
- Instrucciones `AGENTS.md` para mantener continuidad entre sesiones.
- Foundation HTTP con API `/api/v1`, health check de PostgreSQL, validation
  pipe, correlation IDs, errores normalizados, Helmet y CORS configurable.
- Ejemplos `.env.example`, scripts `typecheck`, `check`, `lint:fix`,
  `prisma:format` y `db:ps`.
- Tests de configuración, health y contratos HTTP (9 unitarios y 3 e2e).
- Migración `add_identity_access` con usuarios, sesiones, roles y permisos.
- Bootstrap inicial, login, refresh rotativo, logout, perfil y cambio de password.
- Guards globales de JWT/permisos y aislamiento de Organization por sesión.
- Administración multi-tenant de usuarios y roles personalizados.
- Seed idempotente con Owner y seis roles de sistema.
- Cobertura ampliada a 28 unit tests y 6 e2e.
- Migración `add_locations_warehouses` con FK compuesta anti-fuga de tenant.
- API paginada de sucursales y bodegas, nuevos permisos y seed ficticio.
- Cobertura ampliada a 34 unit tests manteniendo 6 e2e.

### Changed

- ESLint ignora el cliente generado por Prisma.

### Fixed

- Protección Git para archivos `.env` de la raíz y cliente Prisma generado.

### Security

- Los archivos de entorno permanecen fuera del repositorio.
- Se documentó la alerta transitiva de `deepmerge-ts` en la herramienta Prisma;
  no se aplicó el downgrade destructivo propuesto por `npm audit --force`.
- Passwords usan scrypt con salt; refresh tokens se guardan hasheados, rotan y
  sus sesiones pueden revocarse inmediatamente.
