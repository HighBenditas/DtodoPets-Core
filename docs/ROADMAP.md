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

## ✅ FASE 5 — Customers

- ✅ Clientes y múltiples direcciones con default único activo.
- ✅ Normalización de correo/teléfono/RUT y prevención de duplicados.
- ✅ Historial calculable de pedidos y gasto confirmado/completado.

## ✅ FASE 6 — Orders

- ✅ Pedido, items con snapshot comercial, dirección e historial de estados.
- ✅ Totales monetarios CLP, descuentos y costo de envío.
- ✅ Creación, confirmación y cancelación atómicas con inventario.

## ✅ FASE 7 — Payments & Returns

- ✅ Pagos separados del pedido, múltiples pagos y reembolsos.
- ✅ Devoluciones parciales y reintegro opcional de stock.
- ✅ Idempotencia para proveedores de pago y devoluciones.

## ✅ FASE 8 — Logistics

- ✅ Shipments desacoplados, métodos, tracking y costos reales/subsidios.
- ✅ Retiro, despacho propio, marketplace y courier externo.

## ✅ FASE 9 — Sales Channels & Integrations

- ✅ SalesChannel, Integration y ExternalReference.
- ✅ Credenciales protegidas, webhooks e idempotencia reutilizable.
- ✅ Eventos internos mediante outbox transaccional y base para adaptadores.

## ✅ FASE 10 — Mercado Libre

- ✅ Mapping tenant-safe de variantes con snapshots de stock, precio y comisión.
- ✅ Importación de pedidos idempotente por ID externo y huella canónica.
- ✅ Verificación de origen de webhooks, deduplicación y outbox reintentable.

## ✅ FASE 11 — Storefront & Promotions

- ✅ API pública tenant-safe sin costos, saldos internos ni información
  administrativa.
- ✅ Catálogo/disponibilidad, carrito con token opaco y checkout idempotente.
- ✅ Promociones automáticas/cupones con alcance, vigencia y redención auditable.

## ✅ FASE 12 — Analytics & Audit

- ✅ Base persistente de `AuditLog` aplicada con tenant/actor, ciclo de vida,
  índices y trigger que impide borrado o reescritura de identidad.
- ✅ Captura de mutaciones autenticadas sin body/PII/secrets y consulta
  tenant-safe mediante `audit.read`, filtros y paginación.
- ✅ Overview con KPIs reales, flujo de pagos y reporte diario paginado en CLP;
  consultas medidas sin evidencia para una migración adicional.

## 🟡 FASE 13 — Admin Web

- ✅ Scaffold React/Vite/TypeScript, configuración por entorno y scripts de
  calidad/build reproducibles.
- ✅ Login, logout, restauración/rotación, recuperación ante 401 y rutas
  protegidas conectadas al contrato real de la API.
- 🟡 Shell responsive y navegación por permisos implementados; falta inspección
  visual desktop/móvil por una limitación del controlador de navegador.
- ✅ Caja POS para consumidor final con lector como entrada de teclado, carrito,
  pagos simples/mixtos, vuelto, idempotencia y descuento atómico de inventario.
- ✅ Importación de stock RealBase con Excel `.xlsx`, vista previa, diagnóstico
  de filas y aplicación transaccional a catálogo/bodega.
- ⬜ Emitir boleta/factura en RealBase API v2 desde el evento de venta POS y
  habilitar impresión térmica de 80 mm solo tras confirmar el DTE.
- ⬜ Importar los mappings reales de publicaciones Mercado Libre por código de
  barras y sincronizar stock maestro con margen de seguridad inicial de 1.
- ⬜ Pedidos, catálogo, inventario, clientes, usuarios, canales y reportes.
- ⬜ Migrar el refresh token temporal de `sessionStorage` a cookie `HttpOnly`,
  `Secure` y `SameSite` mediante endpoint web/BFF con protección CSRF.

## ⬜ FASE 14 — Automations & AI

- APIs/eventos estables para n8n, WhatsApp y agentes IA.
- Webhooks salientes firmados, reintentos y observabilidad.

## ⬜ FASE 15 — Production Hardening

- CI, imágenes Docker de aplicación, backups/restauración y deploy seguro.
- Rate limiting, readiness, logging estructurado y métricas.
- Revisión de seguridad, performance y recuperación ante fallos.
