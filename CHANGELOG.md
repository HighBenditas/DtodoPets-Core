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
- Migración `add_catalog` con marcas, categorías jerárquicas, productos,
  variantes, imágenes y constraints multi-tenant/monetarios.
- API paginada y protegida de catálogo, búsqueda por SKU/código de barras,
  filtros, creación atómica, variantes e imágenes.
- Seed idempotente de catálogo ficticio y cobertura ampliada a 46 unit tests en
  16 suites, manteniendo 6 e2e.
- Migración `add_inventory` con saldos por bodega/variante, reservas y ledger
  protegido por constraints y trigger append-only.
- API transaccional para ajustes, transferencias, reservas y liberaciones, con
  locks de fila, prevención de negativos e idempotencia por referencia.
- Permisos `inventory.transfer`/`inventory.reserve`, 52 unit tests en 17 suites
  y smoke concurrente real contra PostgreSQL.
- Migración `add_customers` con identidad multi-tenant, direcciones y default
  activo único mediante índice parcial.
- API paginada de clientes con normalización/validación chilena y gestión
  transaccional de direcciones.
- Cobertura ampliada a 65 unit tests en 19 suites y smoke HTTP real de Customers.
- Migraciones `extend_inventory_for_orders` y `add_orders` con reservas
  consumibles, movimiento `COMMIT`, pedidos, items, snapshots e historial.
- API paginada de pedidos con creación, confirmación y cancelación atómicas;
  precios/totales calculados en servidor y transiciones idempotentes.
- Proyección de conteos y gasto confirmado/completado en el detalle de cliente.
- Cobertura ampliada a 72 unit tests en 20 suites, manteniendo 6 e2e, y smoke
  HTTP real del ciclo completo de Orders contra PostgreSQL.
- Migraciones `extend_inventory_for_returns` y `add_payments_returns` con pagos,
  reembolsos, devoluciones parciales y movimiento de inventario `RETURN`.
- APIs multi-tenant de Payments y Returns con importes CLP exactos, múltiples
  pagos, saldo neto, reintegro opcional y huella SHA-256 de idempotencia.
- Cobertura ampliada a 81 unit tests en 22 suites y smoke HTTP real de cobro,
  reembolso parcial/completo y devolución con/sin reintegro de stock.

### Changed

- ESLint ignora el cliente generado por Prisma.
- Las consultas independientes de servicios se ejecutan secuencialmente para
  evitar el uso concurrente de una conexión, compatible con el próximo `pg@9`.

### Fixed

- Protección Git para archivos `.env` de la raíz y cliente Prisma generado.
- Script `start:prod` corregido para la salida real `dist/src/main` de Nest.

### Security

- Los archivos de entorno permanecen fuera del repositorio.
- Se documentó la alerta transitiva de `deepmerge-ts` en la herramienta Prisma;
  no se aplicó el downgrade destructivo propuesto por `npm audit --force`.
- Passwords usan scrypt con salt; refresh tokens se guardan hasheados, rotan y
  sus sesiones pueden revocarse inmediatamente.
