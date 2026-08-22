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

### Changed

- ESLint ignora el cliente generado por Prisma.

### Fixed

- Protección Git para archivos `.env` de la raíz y cliente Prisma generado.

### Security

- Los archivos de entorno permanecen fuera del repositorio.
- Se documentó la alerta transitiva de `deepmerge-ts` en la herramienta Prisma;
  no se aplicó el downgrade destructivo propuesto por `npm audit --force`.
