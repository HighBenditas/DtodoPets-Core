# API

Este documento distingue endpoints implementados de endpoints planificados.

## Implementados

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| GET | `/health` | No | Comprueba conectividad con PostgreSQL |
| GET | `/api/v1` | No | Devuelve nombre y versión de la API |
| POST | `/api/v1/auth/bootstrap` | No, primera instalación | Crea organización, RBAC, Owner y sesión |
| POST | `/api/v1/auth/login` | No | Inicia sesión por organización/email/password |
| POST | `/api/v1/auth/refresh` | No | Rota un refresh token opaco |
| POST | `/api/v1/auth/logout` | Bearer | Revoca la sesión actual (204) |
| GET | `/api/v1/auth/me` | Bearer | Devuelve identidad, roles y permisos |
| POST | `/api/v1/auth/change-password` | Bearer | Cambia contraseña y revoca otras sesiones (204) |
| GET | `/api/v1/organizations` | Bearer + `organizations.read` | Devuelve solo la organización actual |
| GET | `/api/v1/organizations/:id` | Bearer + `organizations.read` | Obtiene la organización propia |
| PATCH | `/api/v1/organizations/:id` | Bearer + `organizations.read/update` | Actualiza nombre o slug propios |
| GET | `/api/v1/users` | Bearer + `users.manage` | Lista usuarios del tenant |
| GET | `/api/v1/users/:id` | Bearer + `users.manage` | Obtiene usuario del tenant |
| POST | `/api/v1/users` | Bearer + `users.manage` | Crea usuario administrativo |
| PATCH | `/api/v1/users/:id` | Bearer + `users.manage` | Edita nombre/estado |
| PUT | `/api/v1/users/:id/roles` | Bearer + `users.manage` | Reemplaza roles con protección Owner |
| GET | `/api/v1/roles` | Bearer + `users.manage` | Lista roles y permisos del tenant |
| POST | `/api/v1/roles` | Bearer + `users.manage` | Crea rol personalizado |
| PATCH | `/api/v1/roles/:id` | Bearer + `users.manage` | Edita rol no-system |
| PUT | `/api/v1/roles/:id/permissions` | Bearer + `users.manage` | Reemplaza permisos de rol no-system |
| DELETE | `/api/v1/roles/:id` | Bearer + `users.manage` | Elimina rol no asignado (204) |

Los DTO aplican whitelist y validación runtime. Los UUID de ruta se validan como
UUID v4. Conflictos Prisma `P2002` y registros ausentes `P2025` se mapean a HTTP.

## Contrato de errores

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": ["property unexpected should not exist"],
  "path": "/api/v1/organizations",
  "correlationId": "...",
  "timestamp": "2026-08-22T00:00:00.000Z"
}
```

Todos los endpoints incluyen `x-correlation-id`.

## Auth

### Bootstrap

Body: `organizationName`, `organizationSlug?`, `email`, `password` (mínimo 12),
`firstName`, `lastName?`. Responde 201 con `accessToken`, `refreshToken`,
`expiresIn`, `tokenType` y `user`. Responde 409 después del primer usuario.

### Login

Body: `organizationSlug`, `email`, `password`. Credenciales inválidas siempre
responden 401 sin revelar si tenant o usuario existen.

### Refresh

Body: `refreshToken`. Cada uso exitoso invalida el valor anterior y entrega uno
nuevo. Tokens expirados, revocados, rotados o de usuarios/organizaciones
inactivos responden 401.

## Usuarios y roles

Los bodies de usuario nunca aceptan `organizationId`; se usa el tenant del
Bearer. Solo un Owner puede asignar o administrar otro Owner, el usuario actual
no puede desactivarse y siempre debe quedar un Owner activo. Los roles `system`
no se pueden modificar; roles personalizados sí pueden configurarse con las
permission keys existentes.

## Planificados

`/api/v1/locations`, `/warehouses`, `/products`, `/categories`, `/brands`,
`/customers`, `/inventory`, `/orders`, `/payments`, `/shipments`, `/channels`,
`/integrations` y `/reports` se documentarán aquí solo cuando existan.
