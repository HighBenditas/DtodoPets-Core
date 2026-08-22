# Arquitectura

## Visión

DTodoPets Core es la fuente de verdad transaccional para ventas y operaciones.
Comienza como monolito modular NestJS para conservar transacciones simples y
límites de dominio claros sin introducir infraestructura prematura.

```mermaid
flowchart LR
  Admin[Panel administrativo] --> API[API NestJS]
  Store[Tienda propia] --> API
  Channels[Marketplaces y WhatsApp] --> Adapters[Adaptadores]
  Adapters --> API
  API --> DB[(PostgreSQL)]
  API --> Cache[(Redis)]
  API --> Events[Eventos internos]
  Events --> Automation[n8n / agentes IA]
```

Las cajas distintas de API, PostgreSQL y Redis representan evolución prevista,
no componentes ya implementados.

## Estado implementado

- `AppModule` compone `PrismaModule` y `OrganizationsModule`.
- `PrismaModule` es global y expone un cliente Prisma con adapter PostgreSQL.
- `OrganizationsModule` implementa CRUD básico contra `Organization`.
- No existen frontend, identidad, eventos ni adaptadores todavía.

## Límites previstos

Cada dominio mantiene controller, DTOs, servicio y pruebas. Acceso a datos pasa
por Prisma. Lógica que atraviese módulos se expone mediante servicios de
aplicación e interfaces explícitas; los controladores no coordinan reglas
transaccionales complejas.

## Flujo de una request objetivo

```mermaid
sequenceDiagram
  participant C as Cliente
  participant M as Middleware/Guards
  participant A as Controller
  participant S as Servicio de aplicación
  participant P as Prisma
  participant D as PostgreSQL
  C->>M: HTTP + credenciales
  M->>M: correlation ID, autenticación, permiso y tenant
  M->>A: identidad validada
  A->>S: DTO validado
  S->>P: operación filtrada por organizationId
  P->>D: consulta/transacción
  D-->>C: respuesta normalizada
```

## Multi-tenancy

`Organization` es el límite de aislamiento. Las entidades de negocio incluirán
`organizationId` e índices/constraints compuestos cuando corresponda. El valor
se deriva del principal autenticado. Las pruebas deben demostrar que un usuario
no puede leer o mutar recursos de otro tenant.

## Decisiones y tradeoffs

- Monolito modular: menor costo operacional y transacciones locales; exige
  disciplina en límites internos.
- Prisma/PostgreSQL: esquema tipado y migraciones revisables; operaciones de
  concurrencia crítica requerirán transacciones y, si aplica, SQL controlado.
- Eventos internos primero: permiten adaptadores futuros sin operar Kafka antes
  de necesitarlo.

Consulta los ADR en `docs/adr/`.
