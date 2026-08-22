# Roadmap

Leyenda: ✅ completado · 🟡 en progreso · ⬜ pendiente · 🔴 bloqueado.

## ✅ FASE 0 — Auditoría y estabilización

- ✅ Inventariar stack, archivos, módulos, endpoints y tests.
- ✅ Contrastar migraciones con PostgreSQL.
- ✅ Verificar Docker, Prisma, TypeScript, tests, lint y build.
- ✅ Crear la documentación base y registrar riesgos.

## ✅ FASE 1 — Foundation

- ✅ Configuración de entorno validada y ejemplos sin secretos.
- ✅ Prefijo `/api/v1`, validación global y errores consistentes.
- ✅ Health check, correlation ID, headers seguros y CORS configurable.
- ✅ Scripts separados para lint, lint fix, typecheck y validación completa.

## ✅ FASE 2 — Identity & Organizations

- ✅ Usuario, sesión renovable y hashing seguro de contraseñas.
- ✅ Login, logout, refresh, cambio de contraseña y perfil autenticado.
- ✅ Roles y permisos persistidos; Owner/Admin/Manager/Seller/Warehouse/Viewer.
- ✅ Roles personalizados sin depender de autorización hardcodeada.
- ✅ Guards de autenticación y permisos.
- ✅ Aislamiento por organización y administración de usuarios.
- ✅ Seed local seguro para organización, roles y administrador ficticio.
- Tests de autenticación, autorización y fuga entre tenants.

## ✅ FASE 3 — Locations & Catalog

- ✅ Sucursales y bodegas multi-tenant, paginadas y sembradas para desarrollo.
- ✅ Marcas, categorías, productos, variantes e imágenes.
- ✅ SKU/código de barras únicos por organización y precios CLP seguros.
- ✅ Paginación, filtros y búsqueda.

## ✅ FASE 4 — Inventory

- ✅ Saldos físico, reservado y disponible por bodega/variante.
- ✅ Ledger inmutable de movimientos.
- ✅ Ajustes, transferencias, reservas y liberaciones transaccionales.
- ✅ Prevención de stock negativo y tests de concurrencia.

## 🟡 FASE 5 — Customers

- Clientes y múltiples direcciones.
- Normalización de correo/teléfono/RUT y prevención de duplicados.
- Historial calculable de pedidos y gasto.

## ⬜ FASE 6 — Orders

- Pedido, items con snapshot comercial, dirección e historial de estados.
- Totales monetarios CLP, descuentos y costo de envío.
- Creación/cancelación atómica con inventario.

## ⬜ FASE 7 — Payments & Returns

- Pagos separados del pedido, múltiples pagos y reembolsos.
- Devoluciones parciales y reintegro opcional de stock.
- Idempotencia para proveedores de pago.

## ⬜ FASE 8 — Logistics

- Shipments desacoplados, métodos, tracking y costos reales/subsidios.
- Retiro, despacho propio, marketplace y courier externo.

## ⬜ FASE 9 — Sales Channels & Integrations

- SalesChannel, Integration y ExternalReference.
- Credenciales protegidas, webhooks e idempotencia reutilizable.
- Eventos de dominio internos y adaptadores de integración.

## ⬜ FASE 10 — Mercado Libre

- Mapping de productos, importación idempotente de pedidos, stock y costos.
- Verificación de webhooks y procesamiento reintentable.

## ⬜ FASE 11 — Storefront & Promotions

- API pública sin costos ni información administrativa.
- Catálogo, disponibilidad, carrito, checkout y promociones auditables.

## ⬜ FASE 12 — Analytics & Audit

- AuditLog seguro para acciones administrativas.
- KPIs reales, reportes paginados y consultas/indexación medidas.

## ⬜ FASE 13 — Admin Web

- Panel responsive conectado a la API real.
- Pedidos, catálogo, inventario, clientes, usuarios, canales y reportes.

## ⬜ FASE 14 — Automations & AI

- APIs/eventos estables para n8n, WhatsApp y agentes IA.
- Webhooks salientes firmados, reintentos y observabilidad.

## ⬜ FASE 15 — Production Hardening

- CI, imágenes Docker de aplicación, backups/restauración y deploy seguro.
- Rate limiting, readiness, logging estructurado y métricas.
- Revisión de seguridad, performance y recuperación ante fallos.
